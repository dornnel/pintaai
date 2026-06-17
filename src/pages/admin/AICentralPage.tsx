import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import {
  Bot, BrainCircuit, DollarSign, BarChart3, GitBranch,
  CheckCircle, ArrowRight, Sparkles,
} from 'lucide-react'

interface AgentCard {
  name: string
  role: string
  description: string
  status: 'active' | 'beta' | 'coming_soon'
  version: string
  icon: React.ElementType
  iconColor: string
  iconBg: string
  href: string
  external?: boolean
}

const AGENTS: AgentCard[] = [
  {
    name: 'Koke',
    role: 'Agente de Atendimento',
    description: 'Agente conversacional que capta leads via chat. Conduz a jornada do cliente, coleta dados do projeto e gera briefing com orçamento estimado.',
    status: 'active',
    version: 'v2.1',
    icon: Bot,
    iconColor: 'text-brand',
    iconBg: 'bg-orange-50',
    href: '/admin/agent',
  },
  {
    name: 'IA Ops',
    role: 'Assistente Administrativo',
    description: 'Agente interno para análise de dados, geração de relatórios, resposta a perguntas sobre o negócio e suporte à tomada de decisão.',
    status: 'active',
    version: 'v1.0',
    icon: BrainCircuit,
    iconColor: 'text-violet-600',
    iconBg: 'bg-violet-50',
    href: '/admin/ai',
  },
  {
    name: 'Motor de Orçamento',
    role: 'Engine de Precificação',
    description: 'Calcula estimativas de preço baseadas em tipo de serviço, área, cômodos, bairro e condições. Alimenta o Koke e o briefing dos pintores.',
    status: 'active',
    version: 'v3.0',
    icon: DollarSign,
    iconColor: 'text-emerald-600',
    iconBg: 'bg-emerald-50',
    href: '/admin/agent?tab=journey',
  },
  {
    name: 'Análise de Sentimento',
    role: 'Intelligence Engine',
    description: 'Classifica automaticamente avaliações e feedbacks dos clientes em positivo, neutro e negativo. Alimenta o Dashboard de Inteligência.',
    status: 'beta',
    version: 'v0.8',
    icon: BarChart3,
    iconColor: 'text-blue-600',
    iconBg: 'bg-blue-50',
    href: '/admin',
  },
  {
    name: 'Jornada do Fluxo',
    role: 'Flow Engine',
    description: 'Configura a sequência de perguntas do Koke via editor visual. Define branches para cliente e pintor, validações e respostas automáticas.',
    status: 'active',
    version: 'v2.0',
    icon: GitBranch,
    iconColor: 'text-amber-600',
    iconBg: 'bg-amber-50',
    href: '/admin/agent?tab=journey',
  },
]

const STATUS_CFG = {
  active: { label: 'Ativo', color: 'bg-green-100 text-green-700' },
  beta: { label: 'Beta', color: 'bg-blue-100 text-blue-700' },
  coming_soon: { label: 'Em breve', color: 'bg-gray-100 text-gray-500' },
}

export function AICentralPage() {
  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-brand to-orange-400 flex items-center justify-center shrink-0">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Central de Inteligência Artificial</h1>
          <p className="text-sm text-gray-500 mt-0.5">Squad de agentes autônomos que operam a plataforma Pintaê</p>
        </div>
      </div>

      {/* Architecture banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-900">
        <p className="font-semibold mb-1">Como o squad funciona</p>
        <p className="text-xs text-amber-800 leading-relaxed">
          O <strong>Koke</strong> conduz a conversa seguindo a <strong>Jornada</strong> (sequência de perguntas) e usa o <strong>Prompt</strong> para tom e validações abertas.
          O <strong>Motor de Orçamento</strong> roda na edge function <code className="bg-amber-100 px-1 rounded">save-lead</code> e alimenta o briefing enviado ao pintor.
          O <strong>IA Ops</strong> é um agente separado para análise interna — não interage com clientes.
        </p>
      </div>

      {/* Agent cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {AGENTS.map((agent, i) => {
          const Icon = agent.icon
          const statusCfg = STATUS_CFG[agent.status]
          return (
            <motion.div
              key={agent.name}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-4 hover:border-gray-200 hover:shadow-sm transition-all"
            >
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${agent.iconBg}`}>
                  <Icon className={`w-5 h-5 ${agent.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900 text-sm">{agent.name}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusCfg.color}`}>
                      {statusCfg.label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{agent.role}</p>
                </div>
                <span className="text-[10px] font-mono text-gray-300 shrink-0">{agent.version}</span>
              </div>

              <p className="text-xs text-gray-600 leading-relaxed flex-1">{agent.description}</p>

              {agent.status === 'coming_soon' ? (
                <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-auto">
                  <CheckCircle className="w-3.5 h-3.5" /> Em desenvolvimento
                </div>
              ) : (
                <Link to={agent.href}
                  className="flex items-center justify-between text-xs font-semibold text-brand hover:text-brand-dark transition-colors mt-auto group">
                  Configurar
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              )}
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
