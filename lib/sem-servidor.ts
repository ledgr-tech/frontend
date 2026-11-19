// Uma frase só para quando o backend não responde (TX-01, #386, #442): diz o que houve e o que fazer.
// Serve também depois de um deploy novo, quando a aba aberta antes chama uma action que não existe mais:
// nesse caso, só recarregar a página resolve.
export const SEM_SERVIDOR = "Não foi possível falar com o servidor. Tente de novo em instantes ou recarregue a página.";
