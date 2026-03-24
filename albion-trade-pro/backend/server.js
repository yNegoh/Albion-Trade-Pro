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
const CACHE_DURATION = 3 * 60 * 1000; // Baixei para 3 min para ser mais atual

const itemsPath = path.join(__dirname, 'items.json');
let ITENS_DATA = [];
try {
    ITENS_DATA = JSON.parse(fs.readFileSync(itemsPath, 'utf8'));
} catch (err) {
    console.error("Erro ao ler items.json");
}

const IDS_PARA_BUSCAR = ITENS_DATA.map(i => i.id).join(',');

app.get('/', (req, res) => { res.send("API Online"); });

app.get('/scanner', async (req, res) => {
    try {
        const agora = Date.now();
        if (cache.data && (agora - cache.lastUpdate < CACHE_DURATION)) {
            return res.json(cache.data);
        }

        const url = `https://west.albion-online-data.com/api/v2/stats/prices/${IDS_PARA_BUSCAR}?locations=Caerleon,Martlock,Bridgewatch,Lymhurst,FortSterling,Thetford`;
        const response = await axios.get(url, { timeout: 10000 });

        const resultados = processarOportunidades(response.data);
        cache.data = resultados;
        cache.lastUpdate = agora;
        res.json(resultados);

    } catch (error) {
        res.status(500).json({ error: "Erro na API" });
    }
});

function processarOportunidades(dataAPI) {
    let oportunidades = [];

    ITENS_DATA.forEach(itemConfig => {
        const precosDesteItem = dataAPI.filter(p => p.item_id === itemConfig.id);

        precosDesteItem.forEach(origem => {
            precosDesteItem.forEach(destino => {
                if (origem.city === destino.city) return;
                
                const precoCompra = origem.sell_price_min;
                const precoVendaBruto = destino.sell_price_min;

                if (precoCompra <= 0 || precoVendaBruto <= 0) return;

                // --- FILTROS DE SEGURANÇA (ANTI-TROLL) ---
                
                // 1. Bloqueia se o preço de venda for mais que 3x o preço de compra 
                // (Itens normais T4-T6 não variam tanto entre cidades)
                if (precoVendaBruto > (precoCompra * 3)) return;

                const taxaPrata = precoVendaBruto * TAXA_MERCADO;
                const lucroLiquido = precoVendaBruto - taxaPrata - precoCompra;
                const roi = (lucroLiquido / precoCompra) * 100;

                // 2. Bloqueia ROI absurdo (Acima de 100% para esses itens é quase sempre erro de dados)
                if (roi > 100) return;

                // 3. Filtro de lucro mínimo (500 pratas)
                if (lucroLiquido > 500) {
                    oportunidades.push({
                        nome: itemConfig.name,
                        id: itemConfig.id,
                        origem: origem.city,
                        destino: destino.city,
                        compra: precoCompra,
                        venda_liquida: Math.round(precoVendaBruto - taxaPrata),
                        lucro: Math.round(lucroLiquido),
                        roi: roi.toFixed(1) + "%"
                    });
                }
            });
        });
    });

    return oportunidades.sort((a, b) => b.lucro - a.lucro);
}

app.listen(PORT, () => console.log(`Rodando`));
