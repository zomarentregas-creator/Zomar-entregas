// Fundo ambiente (aurora) do login, reutilizável nas áreas autenticadas.
// O contentor pai deve ter `isolate` para o fundo ficar por baixo do conteúdo.
export default function Aurora() {
  return (
    <div className="zt-ambient" aria-hidden="true">
      <div className="zm-blob zm-blob-a" />
      <div className="zm-blob zm-blob-b" />
    </div>
  )
}
