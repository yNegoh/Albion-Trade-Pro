const express = require('express');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;
app.use(cors(), express.json());

const baseItems = JSON.parse(fs.readFileSync(path.join(__dirname, 'items.json'), 'utf8'));

app.get('/scanner', async (req, res) => {
    const categoria = req.query.cat || 'flip';
    try {
        const itensFiltrados = baseItems.filter(i => i.cat === categoria);
        let idsParaBuscar = new Set();
        
        itensFiltrados.forEach(item => {
            [4, 5, 6, 7].forEach(t => {
                ["", "@1", "@2", "@3"].forEach(v => {
                    idsParaBuscar.add(`T${t}_${item.id}${v}`);
                    if (item.mat) idsParaBuscar.add(`T${t}_${item.mat}${v}`);
                });
            });
        });

        const url = `https://west.albion-online-data.com/api/v2/stats/prices/${Array.from(idsParaBuscar).slice(0, 300).join(',')}?locations=Caerleon,Martlock,Bridgewatch,Lymhurst,FortSterling,Thetford`;
        const response = await axios.get(url, { timeout: 15000 });
        const dataAPI = response.data;

        let resultados = [];

        itensFiltrados.forEach(itemBase => {
            [4, 5, 6, 7].forEach(t => {
                ["", "@1", "@2", "@3"].forEach((v, iEnch) => {
                    const idProd = `T${t}_${itemBase.id}${v}`;
                    const precosProd = dataAPI.filter(p => p.item_id === idProd && p.sell_price_min > 0 && p.quality < 5);

                    precosProd.forEach(venda => {
                        let infoCompra = { custo: 0, cidade: "", msg: "" };

                        if (categoria === 'flip') {
                            const compra = dataAPI.filter(p => p.item_id === idProd && p.city !== venda.city && p.quality === venda.quality && p.sell_price_min > 0)
                                                 .sort((a,b) => a.sell_price_min - b.sell_price_min)[0];
                            if (compra) {
                                infoCompra = { custo: compra.sell_price_min, cidade: compra.city, msg: "Flip direto" };
                            }
                        } else {
                            const idMat = idProd.replace(itemBase.id, itemBase.mat);
                            const mat = dataAPI.filter(p => p.item_id === idMat && p.sell_price_min > 0)
                                               .sort((a,b) => a.sell_price_min - b.sell_price_min)[0];
                            if (mat) {
                                infoCompra = { 
                                    custo: mat.sell_price_min * itemBase.req, 
                                    cidade: mat.city, 
                                    msg: `${itemBase.req}x ${itemBase.mat} (${mat.sell_price_min}/un)` 
                                };
                            }
                        }

                        if (infoCompra.custo > 0) {
                            if (venda.sell_price_min > (infoCompra.custo * 2.5)) return; 
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
    } catch (e) { res.status(500).json([]); }
});

app.listen(PORT, () => console.log("Servidor V3.1 Pronto"));
