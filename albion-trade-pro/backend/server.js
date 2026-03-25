const express = require('express');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;
app.use(cors());
app.use(express.json());

const baseItems = JSON.parse(fs.readFileSync(path.join(__dirname, 'items.json'), 'utf8'));

app.get('/scanner', async (req, res) => {
    const categoria = req.query.cat || 'flip';
    try {
        const itensFiltrados = baseItems.filter(i => i.cat === categoria);
        let idsParaBuscar = new Set();
        let infoBase = {};

        itensFiltrados.forEach(item => {
            [4, 5, 6].forEach(t => {
                ["", "@1", "@2", "@3"].forEach((v, i) => {
                    const idProd = `T${t}_${item.id}${v}`;
                    idsParaBuscar.add(idProd);
                    infoBase[idProd] = { n: `${item.name} T${t}${i > 0 ? '.'+i : ''}`, mat: item.mat, req: item.req, baseId: item.id };
                    if (item.mat) idsParaBuscar.add(`T${t}_${item.mat}${v}`);
                });
            });
        });

        const url = `https://west.albion-online-data.com/api/v2/stats/prices/${Array.from(idsParaBuscar).slice(0, 300).join(',')}?locations=Caerleon,Martlock,Bridgewatch,Lymhurst,FortSterling,Thetford`;
        const response = await axios.get(url);
        const dataAPI = response.data;

        let resultados = [];

        itensFiltrados.forEach(itemConfig => {
            const idsDesteItem = Array.from(idsParaBuscar).filter(id => id.includes(itemConfig.id));
            
            idsDesteItem.forEach(idProd => {
                const precosProd = dataAPI.filter(p => p.item_id === idProd && p.sell_price_min > 0 && p.quality < 5);

                precosProd.forEach(venda => {
                    let custo = 0;
                    let infoRota = "";

                    if (categoria === 'flip') {
                        // Lógica de Compra Direta em outra cidade
                        const compra = dataAPI.find(p => p.item_id === idProd && p.city !== venda.city && p.quality === venda.quality && p.sell_price_min > 0);
                        if (compra) {
                            custo = compra.sell_price_min;
                            infoRota = `${compra.city} ➔ ${venda.city}`;
                        }
                    } else {
                        // Lógica de Fabricação (Material -> Produto)
                        const idMat = idProd.replace(itemConfig.id, itemConfig.mat);
                        const mat = dataAPI.filter(p => p.item_id === idMat && p.sell_price_min > 0).sort((a,b)=>a.sell_price_min - b.sell_price_min)[0];
                        if (mat) {
                            custo = mat.sell_price_min * itemConfig.req;
                            infoRota = `Material em ${mat.city} (x${itemConfig.req})`;
                        }
                    }

                    if (custo > 0) {
                        // Se venda > 2.5x custo, provavelmente é preço fake, ignoramos.
                        if (venda.sell_price_min > (custo * 2.5)) return;

                        resultados.push({
                            id: idProd, n: infoBase[idProd].n,
                            r: infoRota, c: custo, v: venda.sell_price_min,
                            t: venda.sell_price_min_date, q: venda.quality
                        });
                    }
                });
            });
        });

        // Retorna apenas o Top 60 ordenado pelo maior lucro absoluto
        res.json(resultados.sort((a, b) => (b.v - b.c) - (a.v - a.c)).slice(0, 60));
    } catch (e) { res.status(500).json([]); }
});

app.listen(PORT, () => console.log("V2.0 Online"));
