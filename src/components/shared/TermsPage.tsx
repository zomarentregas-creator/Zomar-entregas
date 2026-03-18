/**
 * ============================================================================
 * TERMS PAGE — Termos de Uso ZOMAR
 * ============================================================================
 * @version 2.0 — Legislação moçambicana
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
      content: 'Ao utilizar a plataforma ZOMAR, o utilizador concorda expressamente com estes Termos de Uso, elaborados em conformidade com a legislação vigente na República de Moçambique. Caso não concorde com alguma das condições aqui estabelecidas, deverá abster-se de utilizar o serviço.',
    },
    {
      title: '2. Descrição do Serviço',
      content: 'A ZOMAR é uma plataforma digital de intermediação de entregas que conecta empreendedores a entregadores verificados em território moçambicano. A ZOMAR não realiza entregas directamente, sendo responsável pela gestão, segurança e protecção das operações efectuadas na plataforma.',
    },
    {
      title: '3. Cadastro e Conta',
      content: 'Para utilizar o serviço é obrigatória a criação de uma conta com informações verídicas, em conformidade com o disposto na Lei n.º 3/2017, de 9 de Janeiro (Lei das Transacções Electrónicas de Moçambique). O utilizador é inteiramente responsável pela segurança das suas credenciais de acesso e por todas as actividades realizadas na sua conta.',
    },
    {
      title: '4. Planos e Pagamentos',
      content: 'Os planos são cobrados mensalmente de forma antecipada, em Meticais (MZN), moeda oficial da República de Moçambique, nos termos da Lei n.º 11/92, de 9 de Outubro (Lei Cambial). O cancelamento pode ser efectuado a qualquer momento, mantendo-se o acesso até ao termo do período pago. Não há reembolso proporcional por cancelamento antecipado.',
    },
    {
      title: '5. Protecção e Cobertura',
      content: 'A cobertura financeira aplica-se apenas a itens declarados correctamente no momento da criação da entrega. Itens com valor declarado inferior ao real não serão cobertos pela diferença. A ZOMAR reserva-se o direito de investigar situações suspeitas antes de processar qualquer ressarcimento, nos termos do Código Comercial de Moçambique.',
    },
    {
      title: '6. Responsabilidades do Empreendedor',
      content: 'O empreendedor é responsável por declarar correctamente o tipo e valor dos itens enviados, por acondicionar adequadamente os produtos, e por garantir que o conteúdo das entregas seja lícito e conforme a legislação moçambicana vigente, incluindo o Código Penal aprovado pela Lei n.º 35/2014, de 31 de Dezembro.',
    },
    {
      title: '7. Responsabilidades do Entregador',
      content: 'O entregador é responsável por manusear os itens com o devido cuidado, cumprir os prazos acordados, comunicar de imediato qualquer ocorrência durante a entrega, e manter os dados cadastrais actualizados. O entregador deve possuir todos os documentos legais exigidos para o exercício da actividade em Moçambique.',
    },
    {
      title: '8. Protecção de Dados Pessoais',
      content: 'A ZOMAR recolhe e trata dados pessoais em conformidade com a Lei n.º 3/2017, de 9 de Janeiro, e demais normas aplicáveis em Moçambique. Os dados são utilizados exclusivamente para a operação do serviço e não são cedidos ou vendidos a terceiros sem consentimento expresso do titular.',
    },
    {
      title: '9. Limitação de Responsabilidade',
      content: 'A ZOMAR não se responsabiliza por atrasos ou danos causados por factores externos, incluindo condições climatéricas adversas, greves, acidentes ou actos de terceiros. A responsabilidade máxima da ZOMAR fica limitada ao valor de cobertura do plano activo do utilizador, nos termos do Código Civil moçambicano.',
    },
    {
      title: '10. Resolução de Conflitos',
      content: 'Em caso de litígio, as partes comprometem-se a recorrer primeiramente à mediação ou conciliação extrajudicial. Não sendo possível a resolução amigável, o conflito será submetido aos Tribunais Judiciais da República de Moçambique competentes, com preferência para o Tribunal Judicial da Cidade de Maputo.',
    },
    {
      title: '11. Alterações aos Termos',
      content: 'A ZOMAR pode alterar estes Termos de Uso a qualquer momento, com notificação prévia de 15 dias por e-mail ou através da plataforma. A utilização continuada do serviço após esse prazo implica a aceitação das novas condições.',
    },
    {
      title: '12. Lei Aplicável',
      content: 'Estes Termos de Uso são regidos e interpretados exclusivamente de acordo com as leis da República de Moçambique, designadamente o Código Civil, o Código Comercial, a Lei das Transacções Electrónicas (Lei n.º 3/2017) e demais legislação aplicável em vigor.',
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
                Última actualização: Março de 2026 · República de Moçambique
              </p>
            </div>
          </div>
        </div>

        {/* Intro */}
        <div className={`p-6 rounded-2xl border ${dk('bg-emerald-500/5 border-emerald-500/20', 'bg-emerald-50 border-emerald-200')}`}>
          <p className={`text-sm leading-relaxed ${dk('text-gray-300', 'text-gray-700')}`}>
            Leia atentamente estes Termos de Uso antes de utilizar a plataforma ZOMAR.
            Estes termos regulam a relação entre a ZOMAR e os seus utilizadores — empreendedores e entregadores —
            e foram elaborados em conformidade com a legislação vigente na{' '}
            <span className={`font-semibold ${dk('text-emerald-400', 'text-emerald-600')}`}>República de Moçambique</span>.
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
              href="mailto:zomarentregas@gmail.com"
              className={`font-medium ${dk('text-emerald-400 hover:text-emerald-300', 'text-emerald-600 hover:text-emerald-700')}`}
            >
              zomarentregas@gmail.com
            </a>
          </p>
        </div>

      </div>
    </div>
  )
}