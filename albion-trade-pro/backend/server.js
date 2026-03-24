const express = require('express');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

const TAXA_MERCADO = 0.065; 
let cache = { data: null, lastUpdate: 0 };
const CACHE_DURATION = 3 * 60 * 1000; 

const baseItems = JSON.parse(fs.readFileSync(path.join(__dirname, 'items.json'), 'utf8'));
let IDS_EXPANDIDOS = [];
let TRADUCOES = {};

// Geração Automática de Variações
baseItems.forEach(base => {
    [4, 5, 6, 7, 8].forEach(t => {
        const idPlano = `T${t}_${base.id}`;
        IDS_EXPANDIDOS.push(idPlano);
        TRADUCOES[idPlano] = `${base.name} T${t}`;

        [1, 2, 3].forEach(e => {
            const idEnch = `T${t}_${base.id}@${e}`;
            IDS_EXPANDIDOS.push(idEnch);
            TRADUCOES[idEnch] = `${base.name} T${t}.${e}`;
        });
    });
});

app.get('/scanner', async (req, res) => {
    try {
        const agora = Date.now();
        if (cache.data && (agora - cache.lastUpdate < CACHE_DURATION)) return res.json(cache.data);

        // Aumentei o limite para 400 itens para pegar mais variações
        const chunks = IDS_EXPANDIDOS.slice(0, 400).join(',');
        const url = `https://west.albion-online-data.com/api/v2/stats/prices/${chunks}?locations=Caerleon,Martlock,Bridgewatch,Lymhurst,FortSterling,Thetford`;
        
        const response = await axios.get(url, { timeout: 15000 });
        const resultados = processarOportunidades(response.data);
        
        cache.data = resultados;
        cache.lastUpdate = agora;
        res.json(resultados);
    } catch (error) {
        res.status(500).json({ error: "Erro na busca" });
    }
});

function processarOportunidades(dataAPI) {
    let oportunidades = [];
    dataAPI.forEach(origem => {
        const destinoData = dataAPI.filter(p => p.item_id === origem.item_id && p.city !== origem.city);
        
        destinoData.forEach(destino => {
            if (origem.sell_price_min <= 0 || destino.sell_price_min <= 0) return;
            if (destino.sell_price_min > (origem.sell_price_min * 3)) return;

            const lucroLiq = destino.sell_price_min * (1 - TAXA_MERCADO) - origem.sell_price_min;
            const roi = (lucroLiq / origem.sell_price_min) * 100;

            // Filtro de relevância: lucro > 1500 e ROI < 100%
            if (lucroLiq > 1500 && roi < 100) {
                oportunidades.push({
                    nome: TRADUCOES[origem.item_id] || origem.item_id,
                    origem: origem.city,
                    destino: destino.city,
                    compra: origem.sell_price_min,
                    venda: Math.round(destino.sell_price_min * (1 - TAXA_MERCADO)),
                    lucro: Math.round(lucroLiq),
                    roi: roi.toFixed(1) + "%",
                    atualizado: destino.sell_price_min_date
                });
            }
        });
    });
    return oportunidades.sort((a, b) => b.lucro - a.lucro);
}

app.listen(PORT, () => console.log("Motor Albion Trader Pronto"));
