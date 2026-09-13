export interface ResearchField {
    id: string;
    label: string;
    shortLabel: string;
    description: string;
    icon: string; // Icon identifier
    color: string; // Accent color token
    suggestions: string[];
    quickStarters: {
        title: string;
        query: string;
        tag: string;
    }[];
}

export const RESEARCH_FIELDS: ResearchField[] = [
    {
        id: 'all',
        label: 'All Disciplines',
        shortLabel: 'All Disciplines',
        description: 'Cross-disciplinary scientific investigation and general research',
        icon: 'Globe',
        color: 'text-sky-400',
        suggestions: [
            'Ask a research question or topic...',
            'e.g. "Compute-optimal Chinchilla scaling laws in LLMs"',
            'e.g. "Climate resilience in Sub-Saharan African agriculture"',
            'e.g. "PRISMA systematic review on GLP-1 receptor agonists"',
            'e.g. "Solid-state lithium battery dendrite suppression mechanisms"',
            'e.g. "Dynamic stochastic general equilibrium models under supply shocks"',
            'e.g. "Algorithmic feed consumption impacts on adolescent cognition"',
        ],
        quickStarters: [
            {
                title: 'LLM Scaling Laws',
                query: 'Empirical analysis of compute-optimal Chinchilla scaling laws and inference efficiency in frontier models',
                tag: 'AI & Systems',
            },
            {
                title: 'CRISPR Gene Editing',
                query: 'Systematic review of off-target cleavage mitigation strategies in CRISPR-Cas9 clinical trials',
                tag: 'Biomedicine',
            },
            {
                title: 'Renewable Microgrids',
                query: 'Optimization of solar-battery microgrid architectures under intermittent industrial load profiles',
                tag: 'Energy',
            },
            {
                title: 'Macroeconomic Shocks',
                query: 'Transmission mechanisms of monetary policy tightening under global supply chain disruptions',
                tag: 'Economics',
            },
        ],
    },
    {
        id: 'cs_ai',
        label: 'Computer Science & AI',
        shortLabel: 'CS & AI',
        description: 'Machine learning, distributed systems, cryptography & architectures',
        icon: 'Cpu',
        color: 'text-indigo-400',
        suggestions: [
            'e.g. "Compute-optimal scaling laws for reasoning and frontier LLMs"',
            'e.g. "KV-cache compression and sparse attention in long-context models"',
            'e.g. "Formal verification of smart contracts using bounded model checking"',
            'e.g. "Diffusion models for discrete token sequence and code generation"',
            'e.g. "Byzantine fault tolerance in high-throughput decentralized protocols"',
            'e.g. "Mechanistic interpretability of induction heads in transformer models"',
        ],
        quickStarters: [
            {
                title: 'KV-Cache Compression',
                query: 'Survey of KV-cache quantization, eviction, and linear attention methods for 1M+ context LLMs',
                tag: 'Efficient LLMs',
            },
            {
                title: 'Mechanistic Interpretability',
                query: 'How do induction heads and superposition explain in-context learning in transformer architectures?',
                tag: 'Interpretability',
            },
            {
                title: 'BFT Consensus',
                query: 'Comparative latency and finality analysis of modern Byzantine Fault Tolerant consensus algorithms',
                tag: 'Distributed Systems',
            },
            {
                title: 'Zero-Knowledge Proofs',
                query: 'Recent advances in recursive STARKs and polynomial commitment schemes for scaling rollups',
                tag: 'Cryptography',
            },
        ],
    },
    {
        id: 'medicine',
        label: 'Medicine & Health',
        shortLabel: 'Medicine',
        description: 'Clinical trials, genomics, pharmacology & public health outcomes',
        icon: 'Activity',
        color: 'text-emerald-400',
        suggestions: [
            'e.g. "GLP-1 receptor agonists efficacy in metabolic syndrome and cardiac health"',
            'e.g. "Single-cell transcriptomics of immune evasion in solid tumors"',
            'e.g. "Biomarkers for early subclinical detection of Alzheimer\'s disease"',
            'e.g. "CRISPR-Cas9 base and prime editing off-target mitigation in vivo"',
            'e.g. "Comparative efficacy of mRNA vs viral vector vaccines in oncology"',
            'e.g. "Metagenomic profiling of gut microbiome in autoimmune pathogenesis"',
        ],
        quickStarters: [
            {
                title: 'GLP-1 Cardiac Outcomes',
                query: 'Meta-analysis of cardiovascular and renal endpoints in GLP-1 receptor agonist clinical trials',
                tag: 'Endocrinology',
            },
            {
                title: 'Tumor Microenvironment',
                query: 'Single-cell RNA sequencing insights into myeloid-derived suppressor cell infiltration in oncology',
                tag: 'Immunotherapy',
            },
            {
                title: 'Alzheimer\'s Plasma Biomarkers',
                query: 'Diagnostic accuracy of plasma p-tau217 compared to amyloid-PET in early Alzheimer\'s disease',
                tag: 'Neurology',
            },
            {
                title: 'In Vivo Prime Editing',
                query: 'Delivery mechanisms and fidelity optimization of prime editors for monogenic genetic disorders',
                tag: 'Genomics',
            },
        ],
    },
    {
        id: 'agri_climate',
        label: 'Agriculture & Climate',
        shortLabel: 'Agri & Climate',
        description: 'Agronomy, climate resilience, sustainable soils & clean energy',
        icon: 'Sprout',
        color: 'text-amber-400',
        suggestions: [
            'e.g. "Drought tolerance genomics in C4 cereal crops under rising temperatures"',
            'e.g. "Soil microbial diversity and carbon sequestration in regenerative farming"',
            'e.g. "Marine microplastic enzymatic degradation kinetics using PETase"',
            'e.g. "Agrivoltaics crop yield optimization under seasonal solar irradiance"',
            'e.g. "Life cycle assessment of biochar amendment in sub-Saharan arid soils"',
            'e.g. "Hyperspectral satellite remote sensing for nitrogen deficiency in crops"',
        ],
        quickStarters: [
            {
                title: 'Soil Carbon Sequestration',
                query: 'Quantifying long-term soil organic carbon retention under regenerative no-till vs biochar practices',
                tag: 'Soil Science',
            },
            {
                title: 'C4 Crop Heat Resilience',
                query: 'Genetic loci associated with thermal stress resilience and photosynthetic efficiency in sorghum',
                tag: 'Crop Genetics',
            },
            {
                title: 'Agrivoltaic Microclimates',
                query: 'Impact of dual-use agrivoltaic panel shading on soil moisture retention and crop evapotranspiration',
                tag: 'Renewables',
            },
            {
                title: 'Enzymatic Plastic Recycling',
                query: 'Engineered cutinase and PETase variants for room-temperature degradation of post-consumer plastics',
                tag: 'Bioengineering',
            },
        ],
    },
    {
        id: 'economics',
        label: 'Economics & Finance',
        shortLabel: 'Economics',
        description: 'Macroeconomics, market microstructure, CBDC & econometrics',
        icon: 'TrendingUp',
        color: 'text-rose-400',
        suggestions: [
            'e.g. "Dynamic stochastic general equilibrium models under supply-side shocks"',
            'e.g. "High-frequency market microstructure and flash crash liquidity cascades"',
            'e.g. "Central bank digital currencies (CBDC) impact on commercial bank deposits"',
            'e.g. "Behavioral heuristics and retail options volume during volatility spikes"',
            'e.g. "Econometric evaluation of universal basic income guaranteed income pilots"',
            'e.g. "Carbon border adjustment mechanism (CBAM) incidence on emerging markets"',
        ],
        quickStarters: [
            {
                title: 'CBDC & Banking Disintermediation',
                query: 'Theoretical and empirical effects of retail CBDC issuance on commercial bank funding and deposit flight',
                tag: 'Monetary Policy',
            },
            {
                title: 'Market Liquidity Cascades',
                query: 'Algorithmic market making, order book thinning, and systemic liquidity dry-ups in high-frequency trading',
                tag: 'Finance',
            },
            {
                title: 'Carbon Border Taxes (CBAM)',
                query: 'Global welfare and trade diversion effects of the EU Carbon Border Adjustment Mechanism',
                tag: 'Trade Economics',
            },
            {
                title: 'Behavioral Bias in Retail Options',
                query: 'Empirical evidence on lottery-preference trading and zero-DTE options impact on intraday volatility',
                tag: 'Behavioral Finance',
            },
        ],
    },
    {
        id: 'physics_engineering',
        label: 'Physics & Engineering',
        shortLabel: 'Physics & Eng',
        description: 'Quantum computing, solid-state materials, fusion & nanotechnology',
        icon: 'Atom',
        color: 'text-cyan-400',
        suggestions: [
            'e.g. "Room-temperature superconductivity mechanisms in compressed hydrides"',
            'e.g. "Solid-state lithium-metal battery dendrite suppression at high C-rates"',
            'e.g. "Photonic quantum computing fault-tolerant error correction using GKP codes"',
            'e.g. "Magnetohydrodynamic turbulence and transport barriers in tokamak reactors"',
            'e.g. "Perovskite-silicon tandem solar cell degradation mechanisms under UV stress"',
            'e.g. "Aerodynamic drag reduction in hypersonic boundary layer transition"',
        ],
        quickStarters: [
            {
                title: 'Solid-State Battery Interfaces',
                query: 'Chemo-mechanical stability of solid electrolyte interphases in lithium-metal batteries at fast charging rates',
                tag: 'Materials Science',
            },
            {
                title: 'Fault-Tolerant Quantum Computing',
                query: 'Threshold analysis of surface codes vs bosonic cat codes for physical qubit overhead reduction',
                tag: 'Quantum Physics',
            },
            {
                title: 'Tokamak Plasma Confinement',
                query: 'Turbulent transport suppression and edge localized mode (ELM) mitigation in spherical tokamaks',
                tag: 'Nuclear Fusion',
            },
            {
                title: 'Tandem Solar Degradation',
                query: 'Halide phase segregation and thermal degradation pathways in wide-bandgap perovskite-silicon tandems',
                tag: 'Photovoltaics',
            },
        ],
    },
    {
        id: 'social_psychology',
        label: 'Social Sciences',
        shortLabel: 'Social Sciences',
        description: 'Cognitive psychology, sociology, algorithmic wellbeing & ethics',
        icon: 'Users',
        color: 'text-violet-400',
        suggestions: [
            'e.g. "Longitudinal impact of algorithmic feed consumption on adolescent wellbeing"',
            'e.g. "Cognitive bias mitigation in high-stakes clinical decision-making"',
            'e.g. "Socio-economic mobility disparities across urban gentrification clusters"',
            'e.g. "Cross-cultural linguistic drift in global distributed remote teams"',
            'e.g. "Polarization dynamics in asymmetric online recommendation systems"',
            'e.g. "Behavioral nudges for public health compliance in high-density urban areas"',
        ],
        quickStarters: [
            {
                title: 'Algorithmic Wellbeing',
                query: 'Longitudinal causal effects of short-form algorithmic video feeds on adolescent attention span and affect',
                tag: 'Psychology',
            },
            {
                title: 'Decision-Making Under Uncertainty',
                query: 'Heuristics, confirmation bias, and debiasing interventions in expert diagnostic reasoning',
                tag: 'Cognitive Science',
            },
            {
                title: 'Urban Displacement & Housing',
                query: 'Spatial econometric modeling of tenant displacement and wealth inequality in gentrifying urban cores',
                tag: 'Urban Sociology',
            },
            {
                title: 'Digital Echo Chambers',
                query: 'Network topologies and affective polarization in algorithmically curated social media discussions',
                tag: 'Communication',
            },
        ],
    },
    {
        id: 'law_policy',
        label: 'Law & Public Policy',
        shortLabel: 'Law & Policy',
        description: 'AI governance, intellectual property, international trade & privacy',
        icon: 'Scale',
        color: 'text-teal-400',
        suggestions: [
            'e.g. "Extraterritorial jurisdiction in generative AI copyright and fair use"',
            'e.g. "Compliance frameworks for high-risk AI under the European AI Act"',
            'e.g. "WTO trade dispute precedents on carbon border adjustment mechanisms"',
            'e.g. "Differential privacy and synthetic data compliance under GDPR and HIPAA"',
            'e.g. "Antitrust enforcement in multi-sided digital platform network effects"',
            'e.g. "Legal liability frameworks for autonomous medical diagnostic algorithms"',
        ],
        quickStarters: [
            {
                title: 'EU AI Act Compliance',
                query: 'Technical and legal auditing methodologies for high-risk AI conformity assessments under the EU AI Act',
                tag: 'AI Regulation',
            },
            {
                title: 'Copyright in Generative Models',
                query: 'Fair use doctrine and commercial infringement liability regarding scraped training sets in generative models',
                tag: 'IP Law',
            },
            {
                title: 'Digital Platform Antitrust',
                query: 'Market definition and self-preferencing remedies under modern competition law in app ecosystems',
                tag: 'Antitrust',
            },
            {
                title: 'Healthcare AI Liability',
                query: 'Apportioning medical malpractice liability between physicians and autonomous clinical decision support AI',
                tag: 'Health Law',
            },
        ],
    },
];

export function getFieldById(id: string): ResearchField {
    return RESEARCH_FIELDS.find((f) => f.id === id) || RESEARCH_FIELDS[0];
}

export function getSuggestionsForField(id: string): string[] {
    const field = getFieldById(id);
    return field.suggestions;
}

export function getQuickStartersForField(id: string) {
    const field = getFieldById(id);
    return field.quickStarters;
}
