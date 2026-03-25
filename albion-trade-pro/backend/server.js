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
let cache = { data: null, lastUpdate: 0 };

const baseItems = JSON.parse(fs.readFileSync(path.join(__dirname, 'items.json'), 'utf8'));
let IDS_EXPANDIDOS = [];
let TRADUCOES = {};

baseItems.forEach(base => {
    [4, 5, 6, 7].forEach(t => {
        ["", "@1", "@2", "@3"].forEach((v, i) => {
            const id = `T${t}_${base.id}${v}`;
            IDS_EXPANDIDOS.push(id);
            TRADUCOES[id] = `${base.name} T${t}${i > 0 ? '.'+i : ''}`;
        });
    });
});

app.get('/scanner', async (req, res) => {
    try {
        const agora = Date.now();
        if (cache.data && (agora - cache.lastUpdate < 120000)) return res.json(cache.data);

        const chunks = IDS_EXPANDIDOS.slice(0, 200).join(',');
        const url = `https://west.albion-online-data.com/api/v2/stats/prices/${chunks}?locations=Caerleon,Martlock,Bridgewatch,Lymhurst,FortSterling,Thetford`;
        
        const response = await axios.get(url, { timeout: 12000 });
        
        let oportunidades = [];
        const dataAPI = response.data;

        dataAPI.forEach(p => {
            if (p.quality === 5 || p.sell_price_min <= 0) return;

            const destinos = dataAPI.filter(d => 
                d.item_id === p.item_id && 
                d.city !== p.city && 
                d.quality === p.quality &&
                d.sell_price_min > 0
            );

            destinos.forEach(venda => {
                if (venda.sell_price_min > (p.sell_price_min * 2.3)) return; 

                const lucro = (venda.sell_price_min * (1 - TAXA)) - p.sell_price_min;
                const roi = (lucro / p.sell_price_min) * 100;

                // Mantemos o lucro mínimo de 2000 para não encher de lixo, 
                // mas a ORDEM agora será pelo ROI.
                if (lucro > 2000 && roi < 60) {
                    oportunidades.push({
                        n: TRADUCOES[p.item_id] || p.item_id,
                        o: p.city,
                        d: venda.city,
                        c: p.sell_price_min,
                        v: Math.round(venda.sell_price_min * (1 - TAXA)),
                        l: Math.round(lucro),
                        r: parseFloat(roi.toFixed(1)), // Agora enviamos como número para ordenar certo
                        q: p.quality,
                        t: venda.sell_price_min_date
                    });
                }
            });
        });

        // 🔥 A MÁGICA AQUI: Ordenando por ROI (r) do maior para o menor
        const final = oportunidades.sort((a, b) => b.r - a.r).slice(0, 100);
        
        cache.data = final;
        cache.lastUpdate = agora;
        res.json(final);
    } catch (e) { res.status(500).json([]); }
});

app.listen(PORT, () => console.log("Motor Ordenado por ROI"));
