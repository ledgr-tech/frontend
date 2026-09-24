/**
 * Os bytes de um arquivo escolhido na tela. FileReader em vez de
 * `blob.arrayBuffer()`: os dois funcionam no navegador, mas só o FileReader
 * existe no jsdom dos testes.
 */
export function lerBytes(arquivo: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(new Uint8Array(leitor.result as ArrayBuffer));
    leitor.onerror = () => reject(leitor.error);
    leitor.readAsArrayBuffer(arquivo);
  });
}
