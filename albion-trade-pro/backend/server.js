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

        // Gera IDs T4 a T7 e encantamentos .0 a .3
        itensFiltrados.forEach(item => {
            [4, 5, 6, 7].forEach(t => {
                ["", "@1", "@2", "@3"].forEach((v, i) => {
                    const id = `T${t}_${item.id}${v}`;
                    idsParaBuscar.push(id);
                    traducoes[id] = `${item.name} T${t}${i > 0 ? '.'+i : ''}`;
                });
            });
        });

        const url = `https://west.albion-online-data.com/api/v2/stats/prices/${idsParaBuscar.slice(0, 250).join(',')}?locations=Caerleon,Martlock,Bridgewatch,Lymhurst,FortSterling,Thetford`;
        const response = await axios.get(url, { timeout: 15000 });
        const dataAPI = response.data;

        let resultados = [];

        dataAPI.forEach(p => {
            // REGRA: Ignorar se não houver preço ou se for OBRA-PRIMA (5)
            if (p.sell_price_min <= 0 || p.quality === 5) return;

            const destinos = dataAPI.filter(d => 
                d.item_id === p.item_id && 
                d.city !== p.city && 
                d.quality === p.quality &&
                d.sell_price_min > 0
            );

            destinos.forEach(venda => {
                const pCompra = p.sell_price_min;
                const pVenda = venda.sell_price_min;

                // Filtro Anti-Troll (Preço de venda não pode ser irreal)
                if (pVenda > (pCompra * 2.3)) return;

                const lucroBruto = pVenda - pCompra;
                if (lucroBruto > 1000) {
                    resultados.push({
                        id: p.item_id,
                        n: traducoes[p.item_id] || p.item_id,
                        o: p.city,
                        d: venda.city,
                        c: pCompra,
                        v: pVenda,
                        t: venda.sell_price_min_date,
                        q: p.quality // 1, 2, 3 ou 4
                    });
                }
            });
        });

        // Ordena por ROI (lucro/compra)
        res.json(resultados.sort((a, b) => ((b.v*0.935)-b.c)/b.c - ((a.v*0.935)-a.c)/a.c).slice(0, 60));
    } catch (e) { 
        res.status(500).json([]); 
    }
});

app.listen(PORT, () => console.log("Base Estável Online"));
