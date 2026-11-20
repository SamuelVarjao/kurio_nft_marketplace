// A API de controle dos mocks é tipada em src/mocks/control.ts; nos testes só
// é acessada via page.evaluate.
interface Window {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  __KURIO_MOCKS__?: any
}
