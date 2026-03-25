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
    const categoria = req.query.cat || 'equip';
    try {
        const itensFiltrados = baseItems.filter(i => i.cat === categoria);
        let idsParaBuscar = [];
        let traducoes = {};

        itensFiltrados.forEach(item => {
            [4, 5, 6, 7].forEach(t => {
                ["", "@1", "@2", "@3"].forEach((v, i) => {
                    const idProd = `T${t}_${item.id}${v}`;
                    idsParaBuscar.push(idProd);
                    traducoes[idProd] = `${item.name} T${t}${i > 0 ? '.'+i : ''}`;
                    if (item.mat) idsParaBuscar.push(`T${t}_${item.mat}${v}`);
                });
            });
        });

        const url = `https://west.albion-online-data.com/api/v2/stats/prices/${idsParaBuscar.slice(0, 300).join(',')}?locations=Caerleon,Martlock,Bridgewatch,Lymhurst,FortSterling,Thetford`;
        const response = await axios.get(url, { timeout: 15000 });
        const data = response.data;

        let resultados = [];
        itensFiltrados.forEach(itemBase => {
            const idsDesteItem = idsParaBuscar.filter(id => id.includes(itemBase.id));
            
            idsDesteItem.forEach(idProd => {
                const precosProd = data.filter(p => p.item_id === idProd && p.sell_price_min > 0 && p.quality < 5);

                precosProd.forEach(venda => {
                    const idCompra = itemBase.mat ? idProd.replace(itemBase.id, itemBase.mat) : idProd;
                    const precosCompra = data.filter(p => p.item_id === idCompra && p.sell_price_min > 0 && p.quality === (itemBase.mat ? 1 : venda.quality));

                    precosCompra.forEach(compra => {
                        if (venda.city === compra.city && !itemBase.mat) return;
                        if (venda.sell_price_min > (compra.sell_price_min * 50)) return; // Anti-troll extra

                        resultados.push({
                            id: idProd, 
                            n: traducoes[idProd],
                            mat_n: itemBase.mat ? `${itemBase.mat} T${idProd.charAt(1)}` : null,
                            o: compra.city,
                            d: venda.city,
                            c_unit: compra.sell_price_min, // Preço unitário do material
                            req: itemBase.req, // Quantidade necessária
                            v_bruta: venda.sell_price_min,
                            t: venda.sell_price_min_date, 
                            q: venda.quality
                        });
                    });
                });
            });
        });

        res.json(resultados);
    } catch (e) { res.status(500).json([]); }
});

app.listen(PORT, () => console.log("Motor Profissional Online"));
