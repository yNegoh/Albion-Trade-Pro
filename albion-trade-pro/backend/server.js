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
                    const id = `T${t}_${item.id}${v}`;
                    idsParaBuscar.push(id);
                    traducoes[id] = `${item.name} T${t}${i > 0 ? '.'+i : ''}`;
                });
            });
        });

        // Albion Data Project API
        const url = `https://west.albion-online-data.com/api/v2/stats/prices/${idsParaBuscar.slice(0, 250).join(',')}?locations=Caerleon,Martlock,Bridgewatch,Lymhurst,FortSterling,Thetford`;
        const response = await axios.get(url, { timeout: 15000 });
        const dataAPI = response.data;

        let resultados = [];

        dataAPI.forEach(p => {
            if (p.sell_price_min <= 0 || p.quality === 5) return;

            // Busca venda em outras cidades para a mesma qualidade
            const destinos = dataAPI.filter(d => 
                d.item_id === p.item_id && 
                d.city !== p.city && 
                d.quality === p.quality &&
                d.sell_price_min > 0
            );

            destinos.forEach(venda => {
                const precoCompra = p.sell_price_min;
                const precoVenda = venda.sell_price_min;

                // Filtro de sanidade para evitar preços fakes (troll)
                if (precoVenda > (precoCompra * 2.5)) return;

                const lucroBruto = precoVenda - precoCompra;
                if (lucroBruto > 1000) {
                    resultados.push({
                        id: p.item_id, // Necessário para a imagem
                        n: traducoes[p.item_id] || p.item_id,
                        o: p.city,
                        d: venda.city,
                        c: precoCompra,
                        v: precoVenda, // Enviando valor bruto para o front calcular a taxa
                        t: venda.sell_price_min_date,
                        q: p.quality
                    });
                }
            });
        });

        // Ordena por maior lucro bruto inicial e limita
        res.json(resultados.sort((a, b) => (b.v - b.c) - (a.v - a.c)).slice(0, 60));
    } catch (e) { 
        console.error(e);
        res.status(500).json([]); 
    }
});

app.listen(PORT, () => console.log("Servidor Online"));
