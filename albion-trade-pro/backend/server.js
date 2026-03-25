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

// Gerador Otimizado
baseItems.forEach(base => {
    [4, 5, 6].forEach(t => {
        const variações = ["", "@1", "@2", "@3"];
        variações.forEach((v, i) => {
            const id = `T${t}_${base.id}${v}`;
            IDS_EXPANDIDOS.push(id);
            TRADUCOES[id] = `${base.name} T${t}${i > 0 ? '.'+i : ''}`;
        });
    });
});

app.get('/scanner', async (req, res) => {
    try {
        const agora = Date.now();
        if (cache.data && (agora - cache.lastUpdate < 180000)) return res.json(cache.data);

        // Busca em blocos menores para não sobrecarregar
        const chunks = IDS_EXPANDIDOS.slice(0, 150).join(',');
        const url = `https://west.albion-online-data.com/api/v2/stats/prices/${chunks}?locations=Caerleon,Martlock,Bridgewatch,Lymhurst,FortSterling,Thetford`;
        
        const response = await axios.get(url, { timeout: 10000 });
        
        // Agrupar dados por item para evitar loops aninhados pesados
        const dadosAgrupados = {};
        response.data.forEach(p => {
            if (!dadosAgrupados[p.item_id]) dadosAgrupados[p.item_id] = [];
            dadosAgrupados[p.item_id].push(p);
        });

        let oportunidades = [];
        for (const itemId in dadosAgrupados) {
            const precos = dadosAgrupados[itemId];
            precos.forEach(origem => {
                precos.forEach(destino => {
                    if (origem.city === destino.city || origem.sell_price_min <= 0 || destino.sell_price_min <= 0) return;
                    
                    // Filtro Anti-Troll (Evita bolsas de 8 milhões)
                    if (destino.sell_price_min > (origem.sell_price_min * 2.5)) return;

                    const lucro = (destino.sell_price_min * (1 - TAXA)) - origem.sell_price_min;
                    const roi = (lucro / origem.sell_price_min) * 100;

                    if (lucro > 2000 && roi < 80) {
                        oportunidades.push({
                            n: TRADUCOES[itemId] || itemId,
                            o: origem.city,
                            d: destino.city,
                            c: origem.sell_price_min,
                            v: Math.round(destino.sell_price_min * (1 - TAXA)),
                            l: Math.round(lucro),
                            r: roi.toFixed(1),
                            t: destino.sell_price_min_date
                        });
                    }
                });
            });
        }

        const final = oportunidades.sort((a, b) => b.l - a.l).slice(0, 100);
        cache.data = final;
        cache.lastUpdate = agora;
        res.json(final);
    } catch (e) { res.status(500).send("Erro"); }
});

app.listen(PORT, () => console.log("Servidor Leve Rodando"));
