const express = require('express');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;
app.use(cors());
app.use(express.json());

const TAXA = 0.065;
const baseItems = JSON.parse(fs.readFileSync(path.join(__dirname, 'items.json'), 'utf8'));

app.get('/scanner', async (req, res) => {
    const categoria = req.query.cat || 'equip';
    try {
        const itensFiltrados = baseItems.filter(i => i.cat === categoria);
        let idsParaBuscar = [];
        let traducoes = {};

        // Gerar IDs e incluir matérias-primas se necessário
        itensFiltrados.forEach(item => {
            [4, 5, 6].forEach(t => {
                const id = `T${t}_${item.id}`;
                idsParaBuscar.push(id);
                traducoes[id] = `${item.name} T${t}`;
                
                if (item.mat) { // Se tem receita, busca o material também
                    idsParaBuscar.push(`T${t}_${item.mat}`);
                    traducoes[`T${t}_${item.mat}`] = `Mat: ${item.mat} T${t}`;
                }
            });
        });

        const url = `https://west.albion-online-data.com/api/v2/stats/prices/${idsParaBuscar.join(',')}?locations=Caerleon,Martlock,Bridgewatch,Lymhurst,FortSterling,Thetford`;
        const response = await axios.get(url);
        const data = response.data;

        let resultados = [];

        itensFiltrados.forEach(itemBase => {
            [4, 5, 6].forEach(t => {
                const idProd = `T${t}_${itemBase.id}`;
                const precosProd = data.filter(p => p.item_id === idProd && p.sell_price_min > 0);

                if (categoria === 'equip') {
                    // LÓGICA DE FLIP (Compra pronto -> Vende pronto)
                    precosProd.forEach(origem => {
                        precosProd.forEach(destino => {
                            if (origem.city === destino.city) return;
                            const lucro = (destino.sell_price_min * (1 - TAXA)) - origem.sell_price_min;
                            const roi = (lucro / origem.sell_price_min) * 100;
                            if (lucro > 2000 && roi < 60) {
                                resultados.push({ n: traducoes[idProd], o: origem.city, d: destino.city, c: origem.sell_price_min, v: Math.round(destino.sell_price_min * (1-TAXA)), l: Math.round(lucro), r: roi.toFixed(1), cat: 'Equipamento' });
                            }
                        });
                    });
                } else {
                    // LÓGICA DE CRAFT (Compra MATERIA PRIMA -> Vende PRODUTO)
                    const idMat = `T${t}_${itemBase.mat}`;
                    const precosMat = data.filter(p => p.item_id === idMat && p.sell_price_min > 0);

                    precosMat.forEach(cidadeMat => {
                        precosProd.forEach(cidadeVenda => {
                            const lucro = (cidadeVenda.sell_price_min * (1 - TAXA)) - cidadeMat.sell_price_min;
                            const roi = (lucro / cidadeMat.sell_price_min) * 100;
                            if (lucro > 1000 && roi < 80) {
                                resultados.push({ n: traducoes[idProd], o: `Mat em ${cidadeMat.city}`, d: `Venda em ${cidadeVenda.city}`, c: cidadeMat.sell_price_min, v: Math.round(cidadeVenda.sell_price_min * (1-TAXA)), l: Math.round(lucro), r: roi.toFixed(1), cat: itemBase.cat });
                            }
                        });
                    });
                }
            });
        });

        res.json(resultados.sort((a, b) => b.r - a.r).slice(0, 100));
    } catch (e) { res.status(500).json([]); }
});

app.listen(PORT, () => console.log("Motor de Categorias Online"));
