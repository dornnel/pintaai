import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-8">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>

        <h1 className="text-3xl font-bold text-gray-900 mb-2">Termos de Uso</h1>
        <p className="text-sm text-gray-400 mb-8">Última atualização: junho de 2025</p>

        <div className="prose prose-sm max-w-none space-y-6 text-gray-700">

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">1. Sobre a Pintai</h2>
            <p>A Pintai é uma plataforma digital de intermediação entre clientes e profissionais de pintura, desenvolvida e operada pela <strong>Pintai Tecnologia Ltda.</strong>, com sede em Florianópolis — SC. A plataforma conecta clientes que buscam serviços de pintura com pintores verificados da região.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">2. Aceitação dos Termos</h2>
            <p>Ao acessar ou usar a Pintai, você concorda com estes Termos de Uso. Se não concordar, não utilize a plataforma. O uso continuado após alterações nos termos implica aceitação das mudanças.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">3. Cadastro e Conta</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Você é responsável pela veracidade dos dados fornecidos no cadastro.</li>
              <li>Uma conta por pessoa. Contas duplicadas podem ser removidas.</li>
              <li>CPF é exigido para finalizar pedidos e garantir segurança nas transações.</li>
              <li>Pintores passam por processo de verificação antes de receber solicitações.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">4. Como Funciona</h2>
            <p>A Pintai facilita a conexão entre cliente e pintor. O cliente descreve o projeto via chat, recebe uma estimativa de IA (apenas referência interna) e pode receber propostas de pintores verificados. A Pintai <strong>não é parte do contrato de serviço</strong> entre cliente e pintor.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">5. Pagamentos e Taxas</h2>
            <p>A Pintai opera um sistema de escrow (depósito em garantia) para proteger clientes e pintores. Os valores ficam retidos até a conclusão do serviço. A plataforma cobra uma taxa de intermediação sobre os valores processados, conforme informado no momento da contratação.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">6. Uso Adequado</h2>
            <p>É proibido usar a plataforma para:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Cadastros falsos ou múltiplos</li>
              <li>Contato direto com pintores para burlar taxas da plataforma</li>
              <li>Compartilhar dados de outros usuários</li>
              <li>Qualquer atividade ilegal ou que viole direitos de terceiros</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">7. Inteligência Artificial</h2>
            <p>A Pintai usa IA para gerar estimativas de custo e briefings técnicos. Esses valores são <strong>apenas referência</strong> e não constituem proposta comercial. O preço final é definido pelo pintor com base em visita técnica ao local.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">8. Responsabilidades</h2>
            <p>A Pintai não se responsabiliza por danos decorrentes de serviços realizados por pintores, disputas entre as partes ou indisponibilidade temporária da plataforma. Nos limites da lei, nossa responsabilidade máxima se restringe ao valor da taxa cobrada na transação em questão.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">9. Privacidade e Dados</h2>
            <p>O tratamento dos seus dados pessoais é regido pela nossa <Link to="/privacidade" className="text-brand hover:underline">Política de Privacidade</Link>, em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei 13.709/2018).</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">10. Alterações</h2>
            <p>A Pintai pode alterar estes termos a qualquer momento, comunicando os usuários por email ou aviso na plataforma com no mínimo 10 dias de antecedência.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">11. Foro</h2>
            <p>Fica eleito o foro da comarca de Florianópolis — SC para dirimir quaisquer litígios relacionados a estes Termos.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">12. Contato</h2>
            <p>Dúvidas sobre estes termos: <a href="mailto:contato@pintai.com.br" className="text-brand hover:underline">contato@pintai.com.br</a></p>
          </section>
        </div>
      </div>
    </div>
  )
}
