const express = require('express');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000; // Porta padrão para o Render

app.use(cors());
app.use(express.json());

// --- CONFIGURAÇÕES DO SISTEMA ---
const TAXA_MERCADO = 0.065; // Taxa de 6.5% (Venda + Anúncio com Premium)
let cache = { data: null, lastUpdate: 0 };
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos de cache

// Caminho para o arquivo de itens
const itemsPath = path.join(__dirname, 'items.json');

// Carregar o arquivo items.json (sua planilha convertida)
let ITENS_DATA = [];
try {
    ITENS_DATA = JSON.parse(fs.readFileSync(itemsPath, 'utf8'));
    console.log(`✅ Sucesso: ${ITENS_DATA.length} itens carregados do items.json`);
} catch (err) {
    console.error("❌ Erro ao ler items.json. Verifique se o arquivo está na pasta backend.");
}

// Criar a string de IDs para a API (ex: T4_BAG,T5_BAG...)
const IDS_PARA_BUSCAR = ITENS_DATA.map(i => i.id).join(',');

// --- ROTAS ---

// 1. Rota de teste (Saúde do sistema)
app.get('/', (req, res) => {
    res.send("Albion Trade Pro API está online! 🚀");
});

// 2. Rota do Scanner (Onde o lucro acontece)
app.get('/scanner', async (req, res) => {
    try {
        const agora = Date.now();

        // Verificar se temos dados recentes no cache
        if (cache.data && (agora - cache.lastUpdate < CACHE_DURATION)) {
            console.log("📦 Servindo dados do cache...");
            return res.json(cache.data);
        }

        console.log("🌐 Buscando novos preços na API do Albion Data Project...");
        
        // Chamada para a API oficial de dados da comunidade
        const url = `https://west.albion-online-data.com/api/v2/stats/prices/${IDS_PARA_BUSCAR}?locations=Caerleon,Martlock,Bridgewatch,Lymhurst,FortSterling,Thetford`;
        
        const response = await axios.get(url, { timeout: 10000 }); // 10 segundos de limite

        if (!response.data || response.data.length === 0) {
            return res.status(404).json({ error: "API do Albion não retornou dados no momento." });
        }

        // Processar os lucros comparando todas as cidades
        const resultados = processarOportunidades(response.data);

        // Salvar no cache
        cache.data = resultados;
        cache.lastUpdate = agora;

        res.json(resultados);

    } catch (error) {
        console.error("❌ Erro no backend:", error.message);
        res.status(500).json({ error: "Erro ao processar dados de mercado." });
    }
});

// --- LÓGICA DE CÁLCULO ---

function processarOportunidades(dataAPI) {
    let oportunidades = [];

    // Cruzamos os dados da nossa "Planilha" (ITENS_DATA) com os preços da API
    ITENS_DATA.forEach(itemConfig => {
        // Filtrar todos os preços que pertencem a este item específico
        const precosDesteItem = dataAPI.filter(p => p.item_id === itemConfig.id);

        precosDesteItem.forEach(origem => {
            precosDesteItem.forEach(destino => {
                // Regras:
                // 1. Não comparar a mesma cidade
                // 2. Preços devem ser maiores que zero
                if (origem.city === destino.city) return;
                if (origem.sell_price_min <= 0 || destino.sell_price_min <= 0) return;

                const precoCompra = origem.sell_price_min;
                const precoVendaBruto = destino.sell_price_min;
                
                // Cálculo: Venda - (Venda * Taxa) - Compra
                const taxaPrata = precoVendaBruto * TAXA_MERCADO;
                const lucroLiquido = precoVendaBruto - taxaPrata - precoCompra;
                const roi = (lucroLiquido / precoCompra) * 100;

                // Filtro de Qualidade: Só mostrar se o lucro for relevante
                if (lucroLiquido > 1000 && roi > 2) {
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

    // Ordenar do maior lucro para o menor
    return oportunidades.sort((a, b) => b.lucro - a.lucro);
}

app.listen(PORT, () => {
    console.log(`
    =========================================
    ✅ BACKEND INICIADO COM SUCESSO
    🚀 Porta: ${PORT}
    📦 Itens monitorados: ${ITENS_DATA.length}
    =========================================
    `);
});
