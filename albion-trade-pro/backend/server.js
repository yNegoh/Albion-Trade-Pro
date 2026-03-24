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
const CACHE_DURATION = 2 * 60 * 1000; // 2 minutos

// --- GERADOR AUTOMÁTICO DE ITENS (T4 A T8 + .1 A .3) ---
const baseItems = JSON.parse(fs.readFileSync(path.join(__dirname, 'items.json'), 'utf8'));
let IDS_EXPANDIDOS = [];
let TRADUCOES = {};

baseItems.forEach(base => {
    [4, 5, 6, 7, 8].forEach(t => {
        // Adiciona .0 (Plano)
        const idPlano = `T${t}_${base.id}`;
        IDS_EXPANDIDOS.push(idPlano);
        TRADUCOES[idPlano] = `${base.name} T${t}`;

        // Adiciona .1, .2, .3 (Encantados)
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

        // API do Albion tem limite de caracteres, buscamos os primeiros 350 itens (os mais importantes)
        const chunks = IDS_EXPANDIDOS.slice(0, 350).join(',');
        const url = `https://west.albion-online-data.com/api/v2/stats/prices/${chunks}?locations=Caerleon,Martlock,Bridgewatch,Lymhurst,FortSterling,Thetford`;
        
        const response = await axios.get(url, { timeout: 15000 });
        const resultados = processarOportunidades(response.data);
        
        cache.data = resultados;
        cache.lastUpdate = agora;
        res.json(resultados);
    } catch (error) {
        res.status(500).json({ error: "Erro ao buscar dados" });
    }
});

function processarOportunidades(dataAPI) {
    let oportunidades = [];
    dataAPI.forEach(origem => {
        const destinoData = dataAPI.filter(p => p.item_id === origem.item_id && p.city !== origem.city);
        
        destinoData.forEach(destino => {
            if (origem.sell_price_min <= 0 || destino.sell_price_min <= 0) return;
            
            // Filtro Anti-Troll: Preço destino não pode ser 3x maior que origem
            if (destino.sell_price_min > (origem.sell_price_min * 3)) return;

            const lucroLiq = destino.sell_price_min * (1 - TAXA_MERCADO) - origem.sell_price_min;
            const roi = (lucroLiq / origem.sell_price_min) * 100;

            if (lucroLiq > 1500 && roi < 100) {
                oportunidades.push({
                    nome: TRADUCOES[origem.item_id] || origem.item_id,
                    origem: origem.city,
                    destino: destino.city,
                    compra: origem.sell_price_min,
                    venda: Math.round(destino.sell_price_min * (1 - TAXA_MERCADO)),
                    lucro: Math.round(lucroLiq),
                    roi: roi.toFixed(1) + "%",
                    atualizado: destino.sell_price_min_date // Data da API
                });
            }
        });
    });
    return oportunidades.sort((a, b) => b.lucro - a.lucro);
}

app.listen(PORT, () => console.log("Servidor Online com " + IDS_EXPANDIDOS.length + " variações"));
