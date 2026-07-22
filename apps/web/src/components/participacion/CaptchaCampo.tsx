/** Campo de antibot aritmético (D-P8). El token viene firmado desde el servidor. */
export function CaptchaCampo({ pregunta, token }: { pregunta: string; token: string }) {
  return (
    <div>
      <label htmlFor="captcha_respuesta" className="mb-1.5 block text-[13.5px] font-semibold">
        Verificación anti-spam: {pregunta}
      </label>
      <input type="hidden" name="captcha_token" value={token} />
      <input
        id="captcha_respuesta"
        name="captcha_respuesta"
        type="number"
        required
        placeholder="Tu respuesta"
        className="w-full rounded-boton border border-linea bg-white px-4 py-2.5 text-[15px]"
      />
    </div>
  );
}
