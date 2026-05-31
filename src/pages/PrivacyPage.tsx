import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-8">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>

        <h1 className="text-3xl font-bold text-gray-900 mb-2">Política de Privacidade</h1>
        <p className="text-sm text-gray-400 mb-8">Última atualização: junho de 2025 · Conforme LGPD (Lei 13.709/2018)</p>

        <div className="space-y-6 text-gray-700 text-sm leading-relaxed">

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">1. Controlador dos Dados</h2>
            <p><strong>Pintaê Tecnologia Ltda.</strong>, Florianópolis — SC. Contato do encarregado (DPO): <a href="mailto:privacidade@pintai.com.br" className="text-brand hover:underline">privacidade@pintai.com.br</a></p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">2. Dados Coletados</h2>
            <div className="space-y-3">
              <div>
                <p className="font-semibold">Dados fornecidos por você:</p>
                <ul className="list-disc pl-5 mt-1 space-y-0.5">
                  <li>Nome completo, email, WhatsApp</li>
                  <li>CPF (para finalização de pedidos)</li>
                  <li>Fotos e vídeos do ambiente a ser pintado</li>
                  <li>Informações do imóvel (tipo, bairro, condição das paredes)</li>
                  <li>Preferências de serviço e observações</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold">Dados coletados automaticamente (com consentimento):</p>
                <ul className="list-disc pl-5 mt-1 space-y-0.5">
                  <li>Endereço IP e localização aproximada (cidade/país)</li>
                  <li>Navegador, sistema operacional e tipo de dispositivo</li>
                  <li>Página de origem, UTM de campanhas</li>
                  <li>Páginas visitadas e tempo de navegação</li>
                  <li>Data e hora do primeiro acesso</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold">Dados coletados sempre (essenciais):</p>
                <ul className="list-disc pl-5 mt-1 space-y-0.5">
                  <li>Identificador de sessão (sem PII)</li>
                  <li>Preferência de cookies</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">3. Finalidades do Tratamento</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Prestação do serviço:</strong> conectar você com pintores e processar pedidos</li>
              <li><strong>Comunicação:</strong> enviar confirmações de pedido, propostas e atualizações de status</li>
              <li><strong>Estimativas com IA:</strong> gerar briefings técnicos e estimativas de custo</li>
              <li><strong>Segurança:</strong> prevenir fraudes, cadastros falsos e duplicatas</li>
              <li><strong>Melhoria da plataforma:</strong> análise de uso para aprimorar a experiência</li>
              <li><strong>Comunicações de marketing:</strong> apenas com seu consentimento explícito</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">4. Base Legal (LGPD)</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Execução de contrato (art. 7º, V): dados necessários para prestar o serviço</li>
              <li>Consentimento (art. 7º, I): para cookies analíticos e marketing</li>
              <li>Legítimo interesse (art. 7º, IX): segurança e prevenção de fraudes</li>
              <li>Obrigação legal (art. 7º, II): retenção para fins fiscais</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">5. Compartilhamento de Dados</h2>
            <p>Seus dados pessoais são compartilhados <strong>apenas</strong> com:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Pintores verificados — <em>dados anonimizados</em> no primeiro contato, completos apenas após aceite</li>
              <li>Supabase (armazenamento) e Asaas (processamento de pagamentos) — parceiros com adequação à LGPD</li>
              <li>Autoridades competentes — apenas por obrigação legal</li>
            </ul>
            <p className="mt-2">Nunca vendemos seus dados a terceiros.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">6. Retenção dos Dados</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Conta ativa: durante todo o período de uso</li>
              <li>Após encerramento: 5 anos para fins fiscais/legais</li>
              <li>Logs de sessão (sem PII): 90 dias</li>
              <li>Dados de tracking com IP: 12 meses</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">7. Seus Direitos (LGPD art. 18)</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Confirmação e acesso aos dados que temos sobre você</li>
              <li>Correção de dados incompletos ou desatualizados</li>
              <li>Anonimização, bloqueio ou eliminação de dados desnecessários</li>
              <li>Portabilidade dos dados a outro fornecedor</li>
              <li>Revogação do consentimento a qualquer momento</li>
              <li>Informação sobre o não fornecimento de consentimento e suas consequências</li>
            </ul>
            <p className="mt-2">Para exercer esses direitos: <a href="mailto:privacidade@pintai.com.br" className="text-brand hover:underline">privacidade@pintai.com.br</a></p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">8. Cookies</h2>
            <p>Usamos dois tipos de cookies:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Essenciais:</strong> funcionamento da plataforma (sessão, autenticação). Sempre ativos.</li>
              <li><strong>Analíticos:</strong> comportamento de navegação e origem do acesso. Só com seu consentimento.</li>
            </ul>
            <p className="mt-2">Você pode gerenciar suas preferências a qualquer momento na plataforma.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">9. Segurança</h2>
            <p>Implementamos medidas técnicas e organizacionais para proteger seus dados: criptografia em trânsito (HTTPS/TLS), controle de acesso por papel, registros de auditoria de ações administrativas e armazenamento seguro em nuvem (Supabase / AWS).</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">10. Alterações nesta Política</h2>
            <p>Atualizações serão comunicadas por email e aviso na plataforma. O uso continuado após publicação implica aceitação.</p>
          </section>

          <div className="mt-8 pt-6 border-t border-gray-100">
            <p className="text-xs text-gray-400">Ver também: <Link to="/termos" className="text-brand hover:underline">Termos de Uso</Link></p>
          </div>
        </div>
      </div>
    </div>
  )
}
