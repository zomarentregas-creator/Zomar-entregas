/**
 * ============================================================================
 * TERMS PAGE — Termos de Uso ZOMAR
 * ============================================================================
 * @version 1.0
 */

import { useNavigate } from 'react-router-dom'
import { FileText, ArrowLeft } from 'lucide-react'

interface TermsPageProps {
  isDarkMode?: boolean
}

export default function TermsPage({ isDarkMode = true }: TermsPageProps) {
  const navigate = useNavigate()
  const dk = (dark: string, light: string) => isDarkMode ? dark : light

  const sections = [
    {
      title: '1. Aceitação dos Termos',
      content: 'Ao utilizar a plataforma ZOMAR, você concorda com estes Termos de Uso. Se não concordar com alguma das condições, não utilize o serviço.',
    },
    {
      title: '2. Descrição do Serviço',
      content: 'A ZOMAR é uma plataforma de intermediação de entregas que conecta empreendedores a entregadores verificados. A ZOMAR não realiza entregas diretamente, sendo responsável apenas pela gestão e proteção das operações na plataforma.',
    },
    {
      title: '3. Cadastro e Conta',
      content: 'Para utilizar o serviço é necessário criar uma conta com informações verídicas. O utilizador é responsável pela segurança das suas credenciais de acesso e por todas as atividades realizadas na sua conta.',
    },
    {
      title: '4. Planos e Pagamentos',
      content: 'Os planos são cobrados mensalmente de forma antecipada. O cancelamento pode ser feito a qualquer momento, com acesso mantido até o fim do período pago. Não há reembolso proporcional por cancelamento antecipado.',
    },
    {
      title: '5. Proteção e Cobertura',
      content: 'A cobertura financeira cobre apenas itens declarados corretamente no momento da criação da entrega. Itens com valor declarado inferior ao real não serão cobertos pela diferença. A ZOMAR reserva-se o direito de investigar casos suspeitos antes de processar ressarcimentos.',
    },
    {
      title: '6. Responsabilidades do Empreendedor',
      content: 'O empreendedor é responsável por declarar corretamente o tipo e valor dos itens enviados, embalar adequadamente os produtos, e garantir que o conteúdo das entregas seja legal e permitido pela legislação vigente.',
    },
    {
      title: '7. Responsabilidades do Entregador',
      content: 'O entregador é responsável por tratar os itens com cuidado, cumprir os prazos acordados, comunicar imediatamente qualquer problema ocorrido durante a entrega, e manter os dados cadastrais atualizados.',
    },
    {
      title: '8. Privacidade de Dados',
      content: 'A ZOMAR coleta e processa dados pessoais conforme a Lei Geral de Proteção de Dados (LGPD). Os dados são utilizados exclusivamente para operação do serviço e não são vendidos a terceiros. Consulte a nossa Política de Privacidade para mais detalhes.',
    },
    {
      title: '9. Limitação de Responsabilidade',
      content: 'A ZOMAR não se responsabiliza por atrasos causados por fatores externos como condições climáticas, acidentes ou atos de terceiros. A responsabilidade máxima da ZOMAR fica limitada ao valor de cobertura do plano ativo do utilizador.',
    },
    {
      title: '10. Alterações nos Termos',
      content: 'A ZOMAR pode alterar estes termos a qualquer momento, com notificação prévia de 15 dias por e-mail. O uso continuado da plataforma após esse prazo implica aceitação das novas condições.',
    },
    {
      title: '11. Foro e Lei Aplicável',
      content: 'Estes termos são regidos pelas leis brasileiras. Qualquer litígio será resolvido no foro da comarca de São Paulo, SP, com renúncia a qualquer outro por mais privilegiado que seja.',
    },
  ]

  return (
    <div className={`min-h-screen ${dk('bg-black', 'bg-gray-50')}`}>
      <div className="max-w-4xl mx-auto px-4 py-12 space-y-8">

        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className={`p-2.5 rounded-xl transition-all ${dk('bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white', 'bg-gray-100 hover:bg-gray-200 text-gray-600')}`}
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-xl ${dk('bg-emerald-500/10', 'bg-emerald-100')}`}>
              <FileText className={dk('text-emerald-400', 'text-emerald-600')} size={24} />
            </div>
            <div>
              <h1 className={`text-2xl font-bold ${dk('text-white', 'text-gray-900')}`}>
                Termos de Uso
              </h1>
              <p className={`text-sm ${dk('text-gray-500', 'text-gray-600')}`}>
                Última atualização: Março de 2026
              </p>
            </div>
          </div>
        </div>

        {/* Intro */}
        <div className={`p-6 rounded-2xl border ${dk('bg-emerald-500/5 border-emerald-500/20', 'bg-emerald-50 border-emerald-200')}`}>
          <p className={`text-sm leading-relaxed ${dk('text-gray-300', 'text-gray-700')}`}>
            Leia atentamente estes Termos de Uso antes de utilizar a plataforma ZOMAR.
            Eles regulam a relação entre a ZOMAR e os seus utilizadores — empreendedores e entregadores.
          </p>
        </div>

        {/* Sections */}
        <div className="space-y-4">
          {sections.map((section, i) => (
            <div
              key={i}
              className={`p-6 rounded-2xl border ${dk('bg-[#121212] border-white/5', 'bg-white border-gray-200 shadow-sm')}`}
            >
              <h2 className={`font-bold text-lg mb-3 ${dk('text-white', 'text-gray-900')}`}>
                {section.title}
              </h2>
              <p className={`text-sm leading-relaxed ${dk('text-gray-400', 'text-gray-600')}`}>
                {section.content}
              </p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className={`p-6 rounded-2xl border text-center ${dk('bg-white/3 border-white/5', 'bg-gray-100 border-gray-200')}`}>
          <p className={`text-sm ${dk('text-gray-500', 'text-gray-600')}`}>
            Dúvidas sobre os termos? Entre em contacto:{' '}
            <a
              href="mailto:juridico@zomar.com"
              className={`font-medium ${dk('text-emerald-400 hover:text-emerald-300', 'text-emerald-600 hover:text-emerald-700')}`}
            >
              juridico@zomar.com
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}