const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// CONFIGURAÇÕES DE MERCADO
const TAXA_MERCADO = 0.065; // 6.5% (Sem premium/Taxas variadas, ajustado para média segura)
let cache = { data: null, lastUpdate: 0 };
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

// LISTA DE ITENS DE ALTO GIRO (T4 a T6)
function gerarListaItens() {
    const bases = [
        "WOOD", "STONE", "ORE", "FIBER", "HIDE", "PLANKS", "STONEBLOCK", "METALBAR", "LEATHER", "CLOTH", // Recursos
        "BAG", "CAPE", "MOUNT_HORSE", "MOUNT_OX", // Utilitários
        "HEAD_LEATHER_SET1", "ARMOR_LEATHER_SET1", "SHOES_LEATHER_SET1", // Set Couro
        "HEAD_PLATE_SET1", "ARMOR_PLATE_SET1", "SHOES_PLATE_SET1", // Set Placa
        "HEAD_CLOTH_SET1", "ARMOR_CLOTH_SET1", "SHOES_CLOTH_SET1", // Set Tecido
        "2H_SWORD", "2H_BOW", "2H_FIRE_STAFF", "2H_CLAW", "MAIN_CURSESTAFF", // Armas Populares
        "FOOD_PIE", "FOOD_OMELETTE", "FOOD_STEW", "POTION_HEAL", "POTION_ENERGY" // Consumíveis
    ];
    const tiers = ["T4", "T5", "T6"];
    const enchants = ["", "@1", "@2", "@3"];
    
    let lista = [];
    tiers.forEach(t => {
        bases.forEach(b => {
            enchants.forEach(e => {
                lista.push(`${t}_${b}${e}`);
            });
        });
    });
    return lista;
}

const ITENS_PARA_BUSCAR = gerarListaItens();

// ROTA PRINCIPAL DO SCANNER
app.get('/scanner', async (req, res) => {
    try {
        const agora = Date.now();
        if (cache.data && (agora - cache.lastUpdate < CACHE_DURATION)) {
            console.log("Servindo do Cache");
            return res.json(cache.data);
        }

        console.log("Buscando novos dados na API...");
        // Dividimos em blocos para não travar a API do Albion
        const itemChunks = ITENS_PARA_BUSCAR.slice(0, 300).join(',');
        const url = `https://west.albion-online-data.com/api/v2/stats/prices/${itemChunks}?locations=Caerleon,Martlock,Bridgewatch,Lymhurst,FortSterling,Thetford`;

        const response = await axios.get(url);
        const resultados = processarLucros(response.data);

        cache.data = resultados;
        cache.lastUpdate = agora;

        res.json(resultados);
    } catch (error) {
        res.status(500).json({ error: "Erro ao buscar dados" });
    }
});

function processarLucros(data) {
    let oportunidades = [];
    
    // Agrupar por item
    const porItem = {};
    data.forEach(entry => {
        if (!porItem[entry.item_id]) porItem[entry.item_id] = [];
        porItem[entry.item_id].push(entry);
    });

    for (const itemId in porItem) {
        const precos = porItem[itemId];
        
        precos.forEach(compra => {
            precos.forEach(venda => {
                if (compra.city === venda.city) return;
                if (compra.sell_price_min <= 0 || venda.sell_price_min <= 0) return;

                const custo = compra.sell_price_min;
                const receitaBruta = venda.sell_price_min;
                const imposto = receitaBruta * TAXA_MERCADO;
                const lucro = receitaBruta - custo - imposto;
                const roi = (lucro / custo) * 100;

                if (lucro > 1000 && roi > 5) { // Filtro básico de relevância
                    oportunidades.push({
                        item: itemId,
                        origem: compra.city,
                        destino: venda.city,
                        preco_compra: custo,
                        preco_venda: receitaBruta,
                        lucro: Math.round(lucro),
                        roi: roi.toFixed(2)
                    });
                }
            });
        });
    }
    return oportunidades.sort((a, b) => b.lucro - a.lucro);
}

app.listen(PORT, () => console.log(`Backend rodando na porta ${PORT}`));
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs'); // Para ler o arquivo de itens
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Carregar dicionário de itens
const ITENS_DATA = JSON.parse(fs.readFileSync('./items.json', 'utf8'));
const IDS_PARA_BUSCAR = ITENS_DATA.map(i => i.id).join(',');

app.get('/scanner', async (req, res) => {
    try {
        console.log("Buscando preços...");
        const url = `https://west.albion-online-data.com/api/v2/stats/prices/${IDS_PARA_BUSCAR}?locations=Caerleon,Martlock,Bridgewatch,Lymhurst,FortSterling,Thetford`;
        
        const response = await axios.get(url);
        const resultados = processarLucros(response.data);
        res.json(resultados);
    } catch (error) {
        res.status(500).json({ error: "Erro no servidor" });
    }
});

function processarLucros(data) {
    let oportunidades = [];
    const TAXA = 0.065;

    ITENS_DATA.forEach(itemInfo => {
        const precosDoItem = data.filter(p => p.item_id === itemInfo.id);
        
        precosDoItem.forEach(compra => {
            precosDoItem.forEach(venda => {
                if (compra.city === venda.city) return;
                if (compra.sell_price_min <= 0 || venda.sell_price_min <= 0) return;

                const custo = compra.sell_price_min;
                const receitaLiq = venda.sell_price_min * (1 - TAXA);
                const lucro = receitaLiq - custo;
                const roi = (lucro / custo) * 100;

                if (lucro > 500) {
                    oportunidades.push({
                        nome: itemInfo.name,
                        origem: compra.city,
                        destino: venda.city,
                        preco_compra: custo,
                        preco_venda: Math.round(receitaLiq),
                        lucro: Math.round(lucro),
                        roi: roi.toFixed(1)
                    });
                }
            });
        });
    });
    return oportunidades.sort((a, b) => b.lucro - a.lucro);
}

app.listen(PORT, () => console.log(`Rodando na porta ${PORT}`));
