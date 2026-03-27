const express = require('express');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

// Configurações do Express
app.use(cors());
app.use(express.json());

// Carregar base de itens (Garanta que o arquivo items.json existe na mesma pasta)
const itemsPath = path.join(__dirname, 'items.json');
let baseItems = [];
try {
    baseItems = JSON.parse(fs.readFileSync(itemsPath, 'utf8'));
} catch (err) {
    console.error("Erro ao carregar items.json:", err.message);
}

// Função auxiliar para dividir arrays em lotes (evita erro de URL muito longa na API)
const chunkArray = (array, size) => {
    const chunked = [];
    for (let i = 0; i < array.length; i += size) {
        chunked.push(array.slice(i, i + size));
    }
    return chunked;
};

app.get('/scanner', async (req, res) => {
    const categoria = req.query.cat || 'flip';
    
    try {
        // Filtrar itens da categoria selecionada
        const itensFiltrados = baseItems.filter(i => {
            if (categoria === 'black') return i.cat === 'flip' || i.cat === 'craft';
            return i.cat === categoria;
        });

        let idsParaBuscar = new Set();
        
        // Gerar IDs de T4 a T8 e Encantamentos .0 a .4
        itensFiltrados.forEach(item => {
            [4, 5, 6, 7, 8].forEach(t => {
                ["", "@1", "@2", "@3", "@4"].forEach(v => {
                    const idFull = `T${t}_${item.id}${v}`;
                    idsParaBuscar.add(idFull);
                    
                    // Adicionar materiais para cálculo de Craft/Refino
                    if (item.mat) idsParaBuscar.add(`T${t}_${item.mat}${v}`);
                });
            });
        });

        const listaIds = Array.from(idsParaBuscar);
        const chunks = chunkArray(listaIds, 150); // Lotes de 150 itens por vez
        
        // Executar chamadas para a API em paralelo
        const promises = chunks.map(chunk => 
            axios.get(`https://west.albion-online-data.com/api/v2/stats/prices/${chunk.join(',')}?locations=Caerleon,Black Market,Martlock,Bridgewatch,Lymhurst,FortSterling,Thetford`, { timeout: 25000 })
        );

        const responses = await Promise.all(promises);
        const dataAPI = responses.flatMap(r => r.data);

        let resultados = [];

        itensFiltrados.forEach(itemBase => {
            [4, 5, 6, 7, 8].forEach(t => {
                ["", "@1", "@2", "@3", "@4"].forEach((v, iEnch) => {
                    const idProd = `T${t}_${itemBase.id}${v}`;
                    
                    // Filtrar preços de venda válidos
                    const precosVenda = dataAPI.filter(p => p.item_id === idProd && p.sell_price_min > 0 && p.quality < 5);

                    precosVenda.forEach(venda => {
                        let infoCompra = { custo: 0, cidade: "", msg: "" };

                        // Lógica para FLIP ou BLACK MARKET (Transporte entre mercados)
                        if (categoria === 'flip' || categoria === 'black') {
                            const melhorCompra = dataAPI.filter(p => 
                                p.item_id === idProd && 
                                p.city !== venda.city && 
                                p.sell_price_min > 0
                            ).sort((a, b) => a.sell_price_min - b.sell_price_min)[0];

                            if (melhorCompra) {
                                infoCompra = { 
                                    custo: melhorCompra.sell_price_min, 
                                    cidade: melhorCompra.city, 
                                    msg: "Compra direta" 
                                };
                            }
                        } 
                        // Lógica para CRAFT ou REFINO (Custo baseado em materiais)
                        else {
                            const idMat = idProd.replace(itemBase.id, itemBase.mat);
                            const melhorMat = dataAPI.filter(p => 
                                p.item_id === idMat && 
                                p.sell_price_min > 0
                            ).sort((a, b) => a.sell_price_min - b.sell_price_min)[0];

                            if (melhorMat) {
                                infoCompra = { 
                                    custo: melhorMat.sell_price_min * (itemBase.req || 1), 
                                    cidade: melhorMat.city, 
                                    msg: `${itemBase.req}x ${itemBase.mat}` 
                                };
                            }
                        }

                        // Verificação de viabilidade e Filtro Anti-Troll (Max 300% de lucro)
                        if (infoCompra.custo > 0) {
                            const lucroBruto = venda.sell_price_min - infoCompra.custo;
                            
                            // Se o preço de venda for mais de 4x o custo (ROI > 300%), ignoramos (Provável erro/troll)
                            if (venda.sell_price_min > (infoCompra.custo * 4)) return;

                            resultados.push({
                                id: idProd,
                                id_base: itemBase.id,
                                tier: t,
                                n: `${itemBase.name} T${t}${iEnch > 0 ? '.' + iEnch : ''}`,
                                o: infoCompra.cidade,
                                d: venda.city,
                                c_bruto: infoCompra.custo,
                                v_bruto: venda.sell_price_min,
                                details: infoCompra.msg,
                                t: venda.sell_price_min_date,
                                q: venda.quality
                            });
                        }
                    });
                });
            });
        });

        res.json(resultados);
    } catch (e) {
        console.error("Erro no processamento:", e.message);
        res.status(500).json({ erro: "Erro interno no servidor" });
    }
});

// Inicialização do servidor
app.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(`   ALBION TRADER PRO V1.5 ATIVO`);
    console.log(`   Porta: ${PORT}`);
    console.log(`=========================================`);
});
