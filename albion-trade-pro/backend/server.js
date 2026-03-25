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
    [4, 5, 6].forEach(t => {
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

        const chunks = IDS_EXPANDIDOS.slice(0, 180).join(',');
        const url = `https://west.albion-online-data.com/api/v2/stats/prices/${chunks}?locations=Caerleon,Martlock,Bridgewatch,Lymhurst,FortSterling,Thetford`;
        
        const response = await axios.get(url, { timeout: 12000 });
        
        // --- NOVIDADE: AGRUPAR POR ITEM E CIDADE (ELIMINA DUPLICATAS DE QUALIDADE) ---
        const melhorPrecoPorCidade = {};
        response.data.forEach(p => {
            const chave = `${p.item_id}_${p.city}`;
            // Se não existe ou se o preço atual é menor que o guardado (e maior que zero)
            if (!melhorPrecoPorCidade[chave] || (p.sell_price_min > 0 && p.sell_price_min < melhorPrecoPorCidade[chave].sell_price_min)) {
                if (p.sell_price_min > 0) melhorPrecoPorCidade[chave] = p;
            }
        });

        // Transformar o objeto de volta em array para o cálculo
        const dataAPI = Object.values(melhorPrecoPorCidade);

        let oportunidades = [];
        dataAPI.forEach(origem => {
            const destinoData = dataAPI.filter(p => p.item_id === origem.item_id && p.city !== origem.city);
            
            destinoData.forEach(destino => {
                const pCompra = origem.sell_price_min;
                const pVenda = destino.sell_price_min;

                // Filtro Anti-Troll mais rigoroso
                if (pCompra < 500 || pVenda < 500) return;
                if (pVenda > (pCompra * 2.2)) return; // Se o preço de venda for +120% que o de compra, ignore (troll)

                const lucro = (pVenda * (1 - TAXA)) - pCompra;
                const roi = (lucro / pCompra) * 100;

                // ROI Realista de mercado (Entre 4% e 55%)
                if (lucro > 1500 && roi > 4 && roi < 55) {
                    oportunidades.push({
                        n: TRADUCOES[origem.item_id] || origem.item_id,
                        o: origem.city,
                        d: destino.city,
                        c: pCompra,
                        v: Math.round(pVenda * (1 - TAXA)),
                        l: Math.round(lucro),
                        r: roi.toFixed(1),
                        t: destino.sell_price_min_date
                    });
                }
            });
        });

        const final = oportunidades.sort((a, b) => b.l - a.l).slice(0, 80);
        cache.data = final;
        cache.lastUpdate = agora;
        res.json(final);
    } catch (e) { res.status(500).json([]); }
});

app.listen(PORT, () => console.log("Motor Refinado"));
