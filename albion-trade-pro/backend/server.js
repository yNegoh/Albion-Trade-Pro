const express = require('express');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;
app.use(cors(), express.json());

// Carregar itens do JSON
const baseItems = JSON.parse(fs.readFileSync(path.join(__dirname, 'items.json'), 'utf8'));

// Função para não estourar o limite de caracteres da URL da API
const chunkArray = (array, size) => {
    const chunked = [];
    for (let i = 0; i < array.length; i += size) chunked.push(array.slice(i, i + size));
    return chunked;
};

app.get('/scanner', async (req, res) => {
    const categoria = req.query.cat || 'flip';
    try {
        const itensFiltrados = baseItems.filter(i => {
            if (categoria === 'black') return i.cat === 'flip' || i.cat === 'craft';
            return i.cat === categoria;
        });

        let idsParaBuscar = new Set();
        
        // Gerar combinações de T4 a T8 e .0 a .4
        itensFiltrados.forEach(item => {
            [4, 5, 6, 7, 8].forEach(t => {
                ["", "@1", "@2", "@3", "@4"].forEach(v => {
                    idsParaBuscar.add(`T${t}_${item.id}${v}`);
                    if (item.mat) idsParaBuscar.add(`T${t}_${item.mat}${v}`);
                    if (item.mat2) idsParaBuscar.add(`T${t}_${item.mat2}${v}`);
                });
            });
        });

        const listaIds = Array.from(idsParaBuscar);
        const chunks = chunkArray(listaIds, 180); 
        
        // Busca em paralelo para ser rápido
        const promises = chunks.map(chunk => 
            axios.get(`https://west.albion-online-data.com/api/v2/stats/prices/${chunk.join(',')}?locations=Caerleon,Black Market,Martlock,Bridgewatch,Lymhurst,FortSterling,Thetford`, { timeout: 20000 })
        );

        const responses = await Promise.all(promises);
        const dataAPI = responses.flatMap(r => r.data);

        let resultados = [];

        itensFiltrados.forEach(itemBase => {
            [4, 5, 6, 7, 8].forEach(t => {
                ["", "@1", "@2", "@3", "@4"].forEach((v, iEnch) => {
                    const idProd = `T${t}_${itemBase.id}${v}`;
                    // Filtra preços válidos (venda > 0)
                    const precosProd = dataAPI.filter(p => p.item_id === idProd && p.sell_price_min > 0 && p.quality < 5);

                    precosProd.forEach(venda => {
                        let infoCompra = { custo: 0, cidade: "", msg: "" };

                        // Lógica de FLIP (ou Oportunidade Black que se comporta como flip/transporte)
                        if (categoria === 'flip' || categoria === 'black') {
                            const compra = dataAPI.filter(p => p.item_id === idProd && p.city !== venda.city && p.sell_price_min > 0)
                                                 .sort((a,b) => a.sell_price_min - b.sell_price_min)[0];
                            if (compra) {
                                infoCompra = { custo: compra.sell_price_min, cidade: compra.city, msg: "Transporte" };
                            }
                        } 
                        // Lógica de CRAFT
                        else {
                            const idMat = idProd.replace(itemBase.id, itemBase.mat);
                            const mat = dataAPI.filter(p => p.item_id === idMat && p.sell_price_min > 0)
                                               .sort((a,b) => a.sell_price_min - b.sell_price_min)[0];
                            if (mat) {
                                infoCompra = { 
                                    custo: mat.sell_price_min * itemBase.req, 
                                    cidade: mat.city, 
                                    msg: `${itemBase.req}x ${itemBase.mat}` 
                                };
                            }
                        }

                        if (infoCompra.custo > 0) {
                            // Regra de segurança para não mostrar lixo
                            if (venda.sell_price_min > (infoCompra.custo * 10)) return; 

                            resultados.push({
                                id: idProd, n: `${itemBase.name} T${t}${iEnch > 0 ? '.'+iEnch : ''}`,
                                o: infoCompra.cidade, d: venda.city,
                                c_bruto: infoCompra.custo, v_bruto: venda.sell_price_min,
                                details: infoCompra.msg, t: venda.sell_price_min_date, q: venda.quality
                            });
                        }
                    });
                });
            });
        });

        res.json(resultados);
    } catch (e) { 
        console.error("Erro no Scanner:", e.message);
        res.status(500).json([]); 
    }
});

app.listen(PORT, () => console.log(`Servidor Albion Pro V4 rodando na porta ${PORT}`));
