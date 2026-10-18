# APC mini mk2 ⇄ Resolume (vía Chataigne)

Configurador visual para el **Akai APC mini mk2** en directo con **Resolume Arena** y, si quieres, otros programas como **Sunlite**. El puente entre los aparatos es **Chataigne**.

Con el configurador decides qué hace cada pad, botón y fader, de qué color y cómo se enciende cada LED, y a qué programa va cada mensaje, todo sin tocar código. Después exportas, y Chataigne aplica el mapa nuevo solo en unos 2 segundos.

```
            MIDI                     OSC  ───────────►  Resolume Arena (7000)
 APC mini mk2 ──────►  Chataigne  ◄──── OSC (7001) ◄──  estado de clips, tempo
            ◄──────    (scripts)   ───► API web (8080)   R/G/B, clip anterior/siguiente, velocidad
          LEDs                     ───► MIDI / OSC  ──►  Sunlite, otros programas (opcional)
```

> Versiones con las que se ha hecho: Resolume Arena 7.26, Chataigne 1.10.4 y APC mini mk2, en Windows.

---

## Índice

1. [Guía rápida](#guía-rápida)
2. [Qué hay en este repositorio](#qué-hay-en-este-repositorio)
3. [Puesta en marcha (primera vez)](#puesta-en-marcha-primera-vez)
4. [Uso diario: cambiar el mapa](#uso-diario-cambiar-el-mapa)
5. [El configurador](#el-configurador)
6. [Sunlite y otros programas](#sunlite-y-otros-programas)
7. [Cómo funciona por dentro](#cómo-funciona-por-dentro)
8. [Velocidad de clip (el fader 7)](#velocidad-de-clip-el-fader-7)
9. [Solución de problemas](#solución-de-problemas)
10. [Referencia técnica](#referencia-técnica)
11. [Desarrollo](#desarrollo)

---

## Guía rápida

1. Descarga el repositorio: botón verde **Code → Download ZIP**, y descomprímelo.
2. Abre **`configurador.html`** con doble clic. Mejor en Chrome o Edge.
3. Ajusta el mapa (ya viene cargado el de Deseo54).
4. Ve a **Exportar**, marca **los 3 scripts** y pulsa **Guardar en la carpeta…**. Elige la carpeta donde Chataigne tiene los scripts.
5. En Chataigne, pulsa **Reload** en el script de cada módulo (`apc`, `resolume` y `resolumeapi`). En el Logger debe salir `Mapa cargado`.

A partir de ahí, para cambiar el mapa basta con editarlo y volver a guardar. Chataigne lo recarga solo.

---

## Qué hay en este repositorio

| Ruta | Qué es |
|---|---|
| `configurador.html` | **La aplicación.** Un solo archivo: se abre con doble clic, sin instalar nada y sin internet. |
| `chataigne/` | Todo listo para Chataigne con el mapa de Deseo54: los 3 scripts, `apc_config.json` y `APC_Resolume.noisette`. |
| `chataigne/apc_config.json` | El mapa: qué hace cada control. Es lo único que cambia en el día a día. |
| `chataigne/apc_to_resolume.js` | Script del módulo MIDI `apc`: lo que pulsas sale hacia Resolume y los demás destinos. |
| `chataigne/resolume_to_apc.js` | Script del módulo OSC `resolume`: pinta los LEDs según el estado de los clips y sincroniza el tempo. |
| `chataigne/resolume_api.js` | Script del módulo HTTP `resolumeapi`: R/G/B del clip seleccionado, clip anterior/siguiente y velocidad por WebSocket. |
| `src/` | Código fuente (ver [Desarrollo](#desarrollo)). |
| `tests/` | Pruebas automáticas, con tus scripts originales como referencia. |

---

## Puesta en marcha (primera vez)

### 1. Requisitos

- Windows con **Chrome o Edge**. Firefox también abre el configurador, pero no puede guardar directamente en carpetas; tendrías que usar el ZIP.
- **Chataigne 1.10.4** y **Resolume Arena 7.26**.
- El **APC mini mk2** conectado por USB.

### 2. Resolume

En **Preferencias**:

| Dónde | Qué |
|---|---|
| OSC | **Entrada** activada en el puerto **7000**. **Salida** a **127.0.0.1**, puerto **7001**. |
| Webserver | Activado en el puerto **8080**. |
| MIDI | **Desactiva el APC**: ni como entrada, ni como salida, ni como superficie de control «Akai APCmini mkII». Si no, Resolume también mueve las capas con los faders y se pisa con Chataigne. |

### 3. Chataigne

Elige una de estas dos opciones.

#### Opción A: mantener tu proyecto (recomendada)

Tu `.noisette` actual ya tiene los módulos y los puertos bien puestos. Solo cambian los scripts:

1. En el configurador, ve a **Exportar**, marca **los 3 scripts** y pulsa **Guardar en la carpeta…**. Elige la carpeta donde están tus scripts actuales (por ejemplo `D:\VISUALES\Jungle Tribal\chataigne`).
   - Tus scripts escritos a mano se guardan como `*.js.bak` antes de reemplazarlos.
   - También puedes usar **Descargar ZIP** y copiar los archivos a mano.
2. En Chataigne, pulsa **Reload** en el script de cada uno de los 3 módulos.
3. Comprueba el **Logger**. Debe salir `Mapa cargado: …\apc_config.json (Deseo54 - …)` tres veces, una por script.

#### Opción B: usar el `.noisette` generado

En **Exportar**, marca también **`APC_Resolume.noisette`** y escribe la carpeta donde vas a poner los scripts. El `.noisette` guarda la ruta completa de cada uno.

Se genera a partir de tu `.noisette` original, con estos cambios:
- **Añade el módulo `resolumews`** (WebSocket Client). Faltaba en el `.noisette` que me pasaste.
- Añade un módulo por cada destino que crees (por ejemplo `sunlite`).
- **Vacía la lista de valores OSC del módulo `resolume`.** Eran unos 115 KB de valores que Chataigne añade solo y que vuelve a crear al recibir mensajes.

> Al abrirlo, revisa el módulo `apc`: que la entrada y la salida sean **«APC mini mk2»** y **no** «MIDIOUT2 (APC mini mk2)». En los módulos MIDI de los destinos, elige su puerto. Chataigne no permite fijarlo desde un archivo generado.

### 4. Comprobar que todo funciona

- En el módulo `apc`, el botón **Test LEDs** enciende todos los pads, una fila de cada color.
- El botón **Refresh LEDs**, o el botón lateral 8, o Shift, repinta todo con el estado real de Resolume.
- Lanza un clip desde Resolume: su pad debe pasar a «sonando» (en Visuales, parpadeo a 1/4).

---

## Uso diario: cambiar el mapa

1. Abre `configurador.html`. Recuerda el último mapa en el que trabajaste.
2. Haz los cambios.
3. Ve a **Exportar** y pulsa **Guardar en la carpeta…**. Basta con `apc_config.json`; no hace falta volver a exportar los scripts. Después de elegir la carpeta una vez, **Ctrl+S** vuelve a guardar ahí mientras tengas el configurador abierto.
4. **Chataigne lo recarga solo en unos 2 segundos** y lo dice en el Logger.

Si un `apc_config.json` está roto (por ejemplo, editado a mano con una coma de más), los scripts **siguen con el mapa anterior** y avisan en el Logger. No se queda el APC muerto en mitad de una sesión.

**Un mapa por club o evento:**
- En la pestaña **Exportar**, «Mapas guardados en este navegador».
- O con **Guardar mapa / Abrir mapa…** de la barra de arriba: un archivo `.json` que puedes llevar a otro PC.

---

## El configurador

### El aparato

El dibujo es el APC tal cual: 8×8 pads, 8 botones laterales (el 1 es el de arriba), 8 botones de abajo, Shift y 9 faders. Las **filas se cuentan desde abajo**, de F1 a F8, como en el brief.

- **Clic:** elige un control. **Ctrl o Mayús + clic:** elige varios. Lo que cambies se aplica a todos.
- **▦** junto a cada fila: **plantilla de fila**. Por ejemplo: «capa 1, clips 9–16, verde, LED de clips normales». Después puedes cambiar pads sueltos.
- **Vista previa:** muestra los pads vacíos, cargados, sonando, una mezcla, o **simula un show**. Los pulsos y parpadeos van al **BPM** que pongas. Los colores de pantalla son aproximados: el LED real siempre se ve algo distinto.

### Qué puede hacer cada control

| Pads | Botones (abajo, laterales, Shift) | Faders |
|---|---|---|
| Lanzar un clip | Bypass de capa(s) | Opacidad de capa |
| Lanzar dos clips a la vez (pixel + madrix) | Vaciar capa(s) | Master de capa |
| R / G / B del clip seleccionado | Blackout | Master de la composición |
| Tap tempo, Resync | Limpiar todo | Opacidad de la composición |
| Bypass, Blackout, Vaciar, Limpiar todo | Clip anterior / siguiente | Velocidad de un clip |
| Clip anterior / siguiente, Refrescar LEDs | Tap tempo, Resync, Refrescar LEDs | Parámetro OSC (con rango) |
| **Mensaje OSC** (a Resolume o a otro destino) | **Mensaje OSC** | **MIDI CC** (Sunlite, etc.) |
| **Mensaje MIDI** (nota, CC o program change) | **Mensaje MIDI** | |

Además, cualquier pad o botón puede **mandar hasta 4 mensajes extra** desde **«Además, enviar…»**. Por ejemplo, el pad de strobo blanco lanza el clip en Resolume y a la vez la escena de strobo en Sunlite.

Los mensajes OSC y MIDI tienen tres **modos**:
- **Pulso:** manda el valor y luego 0, o note on y note off.
- **Mantener:** manda el valor al pulsar y 0 al soltar.
- **Interruptor:** un toque lo enciende y otro lo apaga.

### LEDs

**Pads.** Cada estado se configura por separado, según el tipo de control:

| Tipo de pad | Estados |
|---|---|
| Clips | Vacío · Cargado · Sonando |
| R/G/B | Sin clip seleccionado · Canal quitado · Canal activo |
| Interruptores (bypass, blackout, modo interruptor) | Desactivado · Activado |
| El resto | En reposo · Al pulsar |

En cada estado eliges entre:
- apagado;
- fijo al 10, 25, 50, 65, 75, 90 o 100 %;
- **pulso** a 1/16, 1/8, 1/4 o 1/2;
- **parpadeo** a 1/24, 1/16, 1/8, 1/4 o 1/2.

**Botones** (son de un solo color: los de abajo rojos, los laterales verdes): apagado, encendido o parpadeo.

**Colores.** La paleta muestra arriba los 9 colores comprobados en el aparato (blanco 3, rojo 5, naranja 9, amarillo 13, verde 21, cian 37, azul 45, magenta 53 y rosa 57). Debajo están los 128 colores de la paleta del APC.

### Nombres de clip (pestaña Resolume)

Si cambias el orden de los clips en Resolume, un mapa por números se rompe sin avisar. Para evitarlo:

1. En la pestaña **Resolume**, pulsa **Leer composición**. Solo lee, no cambia nada en Resolume.
   - Si el navegador no deja leer Resolume desde un archivo local, abre `http://127.0.0.1:8080/api/v1/composition` en otra pestaña, guárdalo con Ctrl+S y usa **Cargar desde archivo…**.
2. Con la composición bien, pulsa **Guardar los nombres actuales**. El mapa apunta qué clip va en cada pad.
3. Cuando vuelvas a leer la composición, el configurador te avisa de cada pad cuyo clip ya no coincide. Si encuentra ese clip en otro sitio de la capa, ofrece **Mover al clip N**, o **Mover todos los que se han movido** de una vez.

Con la composición cargada, las capas y los clips se eligen en desplegables con su nombre.

---

## Sunlite y otros programas

Los **destinos** son módulos extra de Chataigne a los que el APC también puede mandar mensajes. Se crean en la pestaña **Destinos**:

- **MIDI:** Sunlite Suite, Lightjams, DMX con entrada MIDI, otro software de VJ…
- **OSC:** otro Resolume, TouchDesigner, QLC+, una tableta con Open Stage Control…

### Sunlite paso a paso (MIDI)

1. Instala **[loopMIDI](https://www.tobias-erichsen.de/software/loopmidi.html)** (gratis) y crea un puerto, por ejemplo «loopMIDI Port». Es un cable MIDI virtual entre Chataigne y Sunlite.
2. En el configurador, en **Destinos**, pulsa **+ Sunlite (MIDI)**. Se crea el destino `sunlite`.
3. En los pads o botones que quieras, elige **Mensaje MIDI** o **Además, enviar… → + MIDI**, con destino `sunlite`:
   - **Nota:** para disparar escenas o botones.
   - **CC:** para valores continuos o interruptores.
   - **Program change:** para cambiar de página o show.
4. Para controlar el dimmer o la velocidad de Sunlite con un fader, elige **MIDI CC** como función del fader.
5. En **Chataigne** hace falta un módulo **MIDI** llamado exactamente `sunlite` con salida al puerto de loopMIDI. El `.noisette` exportado ya lo incluye; solo tienes que elegir el puerto.
6. En **Sunlite**, activa la entrada MIDI con el puerto de loopMIDI y asigna cada nota o CC a su escena, botón o fader, normalmente con el aprendizaje MIDI.

> Cada versión de Sunlite (Suite 2, Suite 3, ESA) tiene el menú de MIDI en un sitio distinto. Busca «MIDI» o «Easy Remote» en sus opciones. Si tu versión acepta OSC, también puedes crear un destino OSC.

Ejemplo: el strobo blanco (fila 8, pad 1) lanza el clip 1 de la capa Strobos y, mientras lo mantienes pulsado, la nota 60 a Sunlite:

```json
{
  "type": "clip", "layer": 2, "clip": 1, "color": 3,
  "led": { "empty": 10, "loaded": 10, "active": 7 },
  "extra": [
    { "type": "midi", "target": "sunlite", "msg": "note", "channel": 1, "number": 60, "value": 127, "mode": "hold" }
  ]
}
```

### Destinos OSC

En **Destinos**, pulsa **+ Destino OSC** y pon la IP y el puerto del programa. Tienes que crear en Chataigne un módulo **OSC** con ese mismo nombre, o usar el `.noisette` exportado.

---

## Cómo funciona por dentro

### Módulos de Chataigne

No se ha cambiado la arquitectura que ya funcionaba:

| Módulo | Tipo | Configuración | Script |
|---|---|---|---|
| `apc` | MIDI | Entrada y salida **APC mini mk2** | `apc_to_resolume.js` |
| `resolume` | OSC | Escucha en **7001**, envía a **127.0.0.1:7000** | `resolume_to_apc.js` |
| `resolumeapi` | HTTP | `http://127.0.0.1:8080/api/v1/`, JSON, Auto add desactivado | `resolume_api.js` |
| `resolumews` | WebSocket Client | `127.0.0.1:8080/api/v1`, Auto add desactivado | ninguno. Solo hace falta con el método de velocidad «WebSocket» |
| *destinos* | MIDI u OSC | los que crees | ninguno |

### El mapa vive fuera de los scripts

Antes, el mapa estaba escrito a mano dentro de los tres scripts y tenía que coincidir en los tres. Ahora los tres scripts son **genéricos** y leen el mismo `apc_config.json`:

- Al arrancar, leen `apc_config.json` de **su propia carpeta**, con `util.readFile(ruta, true)`. Esa función existe en Chataigne 1.10.4: está comprobado en su código fuente.
- Cada 2 segundos miran si el archivo ha cambiado. Si ha cambiado, recargan el mapa y repintan.
- Si no encuentran el archivo, usan el **mapa incluido** en el propio script, que es una copia del mapa en el momento de exportar. Así nunca se quedan sin mapa.
- El script del APC tiene además el botón **Recargar mapa**.

### Reparto del trabajo (igual que antes)

- **`apc_to_resolume.js`** recibe `noteOnEvent`, `noteOffEvent` y `ccEvent` del APC y manda OSC a Resolume, MIDI u OSC a los destinos, y peticiones a la API web cuando hace falta. Al refrescar **no repinta los pads de clips**, para no pisarse con el script de LEDs.
- **`resolume_to_apc.js`** recibe `oscEvent` de Resolume y pinta los LEDs:
  - Usa solo `/connected`. **Ignora `/connect`**, que es el disparo y vale 1 aunque el clip esté sonando.
  - Cada segundo pregunta con `"?"` el estado de todos los clips y el tempo. Cada 5 segundos repinta todo, por si se ha perdido algún mensaje.
  - Pasa el BPM al módulo `apc`, que manda reloj MIDI al APC para que pulsos y parpadeos vayan a tempo.
- **`resolume_api.js`** consulta la API web para lo que necesita leer el estado de Resolume:
  - los R/G/B del clip seleccionado, 5 veces por segundo;
  - el clip anterior o siguiente;
  - la velocidad por WebSocket.

  Los scripts se pasan información con el truco de los parámetros en la URL (`?toggle=r`, `?step=next`, `?speed=1.5`): Resolume los ignora y el script de la API los lee en `dataEvent`.

---

## Velocidad de clip (el fader 7)

### Por qué no funcionaba

En el `APC_Resolume.noisette` que me pasaste **no existe el módulo `resolumews`**. Solo hay `apc`, `resolume` y `resolumeapi`. El script hacía `root.modules.resolumews.send(…)` sobre un módulo que no existe, así que el mensaje nunca salía.

Si en tu PC sí tienes ese módulo y aun así no funcionaba, la causa es otra. Con la opción **debug** activada (pestaña Opciones), el Logger muestra cada paso.

### La solución nueva (por defecto): PUT por la API web, sin ids

`apc_to_resolume.js` manda directamente:

```
PUT http://127.0.0.1:8080/api/v1/composition/layers/3/clips/10
Content-Type: application/json

{"transport":{"controls":{"speed":{"value":1.5}}}}
```

- **No necesita ids**, que cambian cada vez que se abre Resolume, **ni WebSocket**: va por el módulo HTTP que ya usas.
- Se manda **como mucho 20 veces por segundo**, aunque el fader mande más, para no saturar la API.
- He comprobado en el código de Chataigne 1.10.4 que `sendPUT` existe y que manda el cuerpo JSON.
- Que Resolume acepte el `PUT` sobre un clip concreto es coherente con lo que ya comprobaste (`PUT /composition/clips/selected` con `video.r` devuelve 204).

> **Sin probar en tu equipo.** Pruébalo fuera de un show: mueve el fader 7 con el clip 10 de Outline sonando.
>
> Si no funciona:
> - Ve a **Opciones → Velocidad de clip** y elige **WebSocket**, que es el método antiguo.
> - Asegúrate de que existe el módulo `resolumews`: el `.noisette` generado ya lo trae.
> - Si aun así no va, activa **debug** y mira el Logger de Chataigne.

### Prueba rápida desde Windows, sin Chataigne

En PowerShell, con un clip en la capa 3, clip 10:

```powershell
Invoke-RestMethod -Method Put -Uri http://127.0.0.1:8080/api/v1/composition/layers/3/clips/10 `
  -ContentType 'application/json' -Body '{"transport":{"controls":{"speed":{"value":2}}}}'
```

Si el clip pasa a ir al doble de velocidad, el método PUT funciona.

---

## Qué está comprobado y qué falta por probar

**Comprobado aquí, sin tu equipo:**
- Los scripts nuevos mandan exactamente lo mismo que los tuyos con el mapa de Deseo54. Son 1092 comprobaciones en un Chataigne simulado; ver [Desarrollo](#desarrollo).
- Las funciones de Chataigne 1.10.4 que usan los scripts existen, comprobado en su código fuente:
  - `util.readFile`, `util.fileExists`, `script.getScriptDirectory`;
  - `sendPUT` con cuerpo JSON;
  - `sendNoteOn`, `sendNoteOff`, `sendCC` y `sendProgramChange`;
  - `send` del módulo WebSocket.
- Las construcciones de JavaScript que usan los scripts existen en el motor de JUCE, por ejemplo `objeto["clave"]`, `undefined` y `Math.round`.
- El configurador funciona en Chromium sin errores: edición, plantillas, deshacer, destinos, composición de Resolume y exportar a ZIP.

**Por probar en tu equipo, fuera de un show:**
1. Que los tres scripts cargan `apc_config.json`. Lo verás en el Logger.
2. La velocidad de clip por **PUT** (fader 7).
3. El `.noisette` generado: el módulo `resolumews` y los módulos de destinos se han escrito con el mismo formato que los de tu archivo, pero no se han abierto en Chataigne. Si da problemas, usa la **opción A** y crea esos módulos a mano.
4. Sunlite por loopMIDI.

---

## Solución de problemas

| Síntoma | Causa probable y solución |
|---|---|
| Los LEDs no se encienden | Revisa la salida del módulo `apc`: tiene que ser «APC mini mk2», **no** «MIDIOUT2 (APC mini mk2)». Pulsa **Test LEDs**. |
| Los faders mueven capas «a su manera» | El APC sigue activado en Resolume. Desactívalo en Preferencias → MIDI. |
| El clip que suena aparece como «cargado» | Algo está usando `/connect` en vez de `/connected`. Los scripts de este repositorio ya lo ignoran. |
| El Logger dice «No hay mapa» | Falta `apc_config.json` en la misma carpeta que los scripts. Exporta otra vez. |
| El Logger dice «No se pudo leer … (¿JSON roto?)» | El archivo está mal escrito. El script sigue con el mapa anterior. Vuelve a guardarlo desde el configurador. |
| «No existe el módulo "sunlite"» | Crea en Chataigne un módulo con ese nombre exacto, o usa el `.noisette` exportado. |
| R/G/B al 10 % siempre | No hay clip seleccionado en Resolume, o está vacío. Es normal. |
| «Leer composición» falla | El navegador bloquea leer Resolume desde un archivo local. Usa **Cargar desde archivo…** (ver la pestaña Resolume). |
| «Guardar en la carpeta» no aparece o falla | Usa Chrome o Edge, o **Descargar ZIP**. |
| Los parpadeos no van a tempo | Activa «Parpadeos y pulsos al BPM de Resolume» en Opciones. En el módulo `apc`, `values → tempo → sendClock` tiene que estar activado: lo activa el script. |

---

## Referencia técnica

### APC mini mk2

| Control | MIDI |
|---|---|
| Pads | Notas 0–63. La 0 es abajo a la izquierda; nota = fila × 8 + columna, con la fila 0 abajo. |
| Botones de abajo | Notas 100–107 |
| Botones laterales | Notas 112–119 (112 = arriba) |
| Shift | Nota 122 |
| Faders | CC 48–55, y CC 56 el master, en el canal 1 |

**LED de un pad:** Note On en el que la **velocity es el color** (paleta de 128) y el **canal es el brillo o la animación**:

| Canal | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8–11 | 12–16 |
|---|---|---|---|---|---|---|---|---|---|
| Efecto | 10 % | 25 % | 50 % | 65 % | 75 % | 90 % | 100 % | pulso 1/16, 1/8, 1/4, 1/2 | parpadeo 1/24, 1/16, 1/8, 1/4, 1/2 |

**LED de un botón:** Note On por el canal 1, con velocity 0 apagado, 1 encendido y 2 parpadeo.

### OSC de Resolume usado

| Acción | Dirección |
|---|---|
| Lanzar clip | `/composition/layers/L/clips/C/connect` 1 |
| Estado de clip (feedback) | `/composition/layers/L/clips/C/connected`: 0 vacío, 1 cargado, 2 cargado en preview, 3 sonando, 4 sonando en preview |
| Vaciar capa | `/composition/layers/L/clear` 1 |
| Limpiar todo | `/composition/disconnectall` 1 y luego 0 |
| Blackout | `/composition/bypassed` 1/0 |
| Bypass de capa | `/composition/layers/L/bypassed` 1/0 |
| Master de composición | `/composition/master` 0–1 (no confundir con `/composition/video/opacity`) |
| Opacidad de capa / master de capa | `/composition/layers/L/video/opacity` · `/composition/layers/L/master` |
| Tap / resync | `/composition/tempocontroller/tempotap` · `/composition/tempocontroller/resync` (1 y luego 0) |
| Tempo | `/composition/tempocontroller/tempo`, normalizado: BPM = 20 + valor × 480 |
| R/G/B del clip seleccionado | `/composition/selectedclip/video/rscale` (y `gscale`, `bscale`) 1/0 |

### Formato de `apc_config.json`

```jsonc
{
  "format": "apc-resolume", "version": 1,
  "name": "Deseo54 - DMST DESEO 54 PLANTILLAS",
  "resolume": { "host": "127.0.0.1", "apiPort": 8080 },   // solo para leer la composición
  "layers": { "1": "Visuales", "2": "Strobos" },          // nombres para la interfaz
  "targets": [ { "id": "sunlite", "type": "midi", "label": "Sunlite Suite", "device": "loopMIDI Port" } ],
  "pads":    [ /* 64, índice = nota del pad */ ],
  "bottom":  [ /* 8 botones de abajo */ ],
  "side":    [ /* 8 botones laterales, el 0 es el de arriba */ ],
  "shift":   { "type": "refresh", "led": { "idle": 0, "active": 0 } },
  "faders":  [ /* 9 */ ],
  "options": { "tempoSync": true, "pollHz": 1, "repaintEvery": 5, "rgbHz": 5,
               "speedMethod": "put", "autoReload": true, "debug": false }
}
```

Campos de cada control:

| `type` | Campos |
|---|---|
| `clip` | `layer`, `clip`, `name` (nombre esperado del clip, para avisar si cambia) |
| `dual` | lo de `clip` más `layer2`, `clip2`, `name2` |
| `rgb` | `rgb`: `"r"`, `"g"` o `"b"` |
| `bypass`, `clear` | `layers`: lista de capas |
| `prev`, `next` | `layer` |
| `osc` | `target` (`"resolume"` u otro destino OSC), `address`, `value`, `mode` (`pulse`, `hold` o `toggle`) |
| `midi` | `target`, `msg` (`note`, `cc` o `pc`), `channel` (1–16), `number`, `value`, `mode` |
| `blackout`, `clearAll`, `tap`, `resync`, `refresh`, `none` | ninguno |

- **Pads:** `color` (velocity 0–127) y `led`: `{ "empty", "loaded", "active" }` (canal 0–16; 0 = apagado).
- **Botones:** `led`: `{ "idle", "active" }` (0, 1 o 2).
- **Todos (pads y botones):** `label` y `extra`, con hasta 4 acciones `osc` o `midi`.

Faders (`type`):

| `type` | Campos |
|---|---|
| `layerOpacity`, `layerMaster` | `layer` |
| `compMaster`, `compOpacity`, `none` | ninguno |
| `clipSpeed` | `layer`, `clip`, `min`, `max` (curva exponencial) |
| `osc` | `target`, `address`, `min`, `max` |
| `midiCC` | `target`, `channel`, `number`, `min`, `max` (0–127) |

No hace falta editar este archivo a mano: el configurador lo escribe completo y validado.

---

## Desarrollo

```
src/
  app/configurador.html   interfaz (HTML + CSS)
  app/app.js              lógica de la interfaz
  generator.js            normaliza y valida el mapa; genera scripts, .noisette y ZIP (se usa en Node y en el navegador)
  scripts/*.js            los 3 scripts de Chataigne (plantillas con la marca del mapa incluido)
  default_config.json     el mapa de Deseo54 (lo genera make_default_config.js)
  noisette_template.json  tu .noisette original, sin los valores OSC auto-añadidos
build.js                  junta todo en configurador.html y chataigne/
tests/                    pruebas (Node, sin dependencias)
```

```bash
npm run build   # regenera configurador.html y chataigne/
npm test        # build + todas las pruebas
```

Las pruebas no necesitan Chataigne ni Resolume: simulan el entorno de scripts de Chataigne.

- **`compare_original.test.js`** ejecuta **tus scripts originales y los nuevos** con los mismos eventos: todos los pads, botones y faders, 6 capas × 20 clips × todos los estados, bypass, blackout, tempo, R/G/B y clip anterior/siguiente. Comprueba que mandan exactamente lo mismo: **1092 comprobaciones**. Las únicas diferencias son intencionadas y están listadas en la propia prueba:
  - el fader 7 usa el método nuevo (PUT);
  - el botón lateral 7, que está libre, ya no se enciende al pulsarlo;
  - al refrescar, también se pregunta el estado del strobe negro;
  - al refrescar, los mensajes salen en otro orden.
- **`features.test.js`** prueba lo nuevo:
  - OSC libre e interruptores;
  - destinos MIDI y OSC, y acciones extra;
  - recarga del mapa y JSON roto;
  - mapa incluido en el script y velocidad por PUT y por WebSocket.
- **`generator.test.js`** prueba la normalización, la composición de Resolume, el aviso de clips movidos y el ZIP.
- **`check_chataigne_syntax.js`** comprueba que los scripts no usan nada que el motor JavaScript de Chataigne (JUCE) no entienda: `let`, `const`, funciones flecha, expresiones regulares, `switch`, métodos modernos de array…

**Limitaciones del motor de scripts de Chataigne (respetadas en `src/scripts/`):**
- Sin `let`, `const`, funciones flecha, expresiones regulares ni `switch`.
- No usar `Array.indexOf`: buscar con un bucle.
- Las funciones definidas al final del archivo solo se pueden usar desde callbacks como `init`, `update` o los eventos, no desde el código suelto de arriba.
