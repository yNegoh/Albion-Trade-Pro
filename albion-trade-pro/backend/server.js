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
                    if (origem.city === destino.city) return;
                    
                    const pCompra = origem.sell_price_min;
                    const pVenda = destino.sell_price_min;
                    const pOrdemCompra = destino.buy_price_max; // Preço que as pessoas estão oferecendo para comprar

                    // --- FILTROS ANTI-FAKE ---
                    if (pCompra <= 100 || pVenda <= 100) return;
                    
                    // 1. Se o preço de venda é 2x maior que o de compra, é suspeito para esses itens
                    if (pVenda > (pCompra * 2)) return;

                    // 2. Se não existe Ordem de Compra ou ela é muito baixa, o item não tem liquidez (é ghost)
                    if (pOrdemCompra <= 0 || pOrdemCompra < (pCompra * 0.5)) return;

                    const lucro = (pVenda * (1 - TAXA)) - pCompra;
                    const roi = (lucro / pCompra) * 100;

                    // 3. ROI entre 3% e 60% (Onde mora o lucro real de trade)
                    if (lucro > 1500 && roi > 3 && roi < 60) {
                        oportunidades.push({
                            n: TRADUCOES[itemId] || itemId,
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
        }

        const final = oportunidades.sort((a, b) => b.l - a.l).slice(0, 80);
        cache.data = final;
        cache.lastUpdate = agora;
        res.json(final);
    } catch (e) { res.status(500).json([]); }
});

app.listen(PORT, () => console.log("Motor Protegido Rodando"));
