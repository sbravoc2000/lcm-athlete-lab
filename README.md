# LCM Athlete Lab v2.2

Sistema local de evaluación deportiva y clínica del Laboratorio de Ciencias del Movimiento (UPC).

## Cómo abrirlo

- **`LCM_Athlete_Lab.html`**: versión de un solo archivo. Doble clic para abrirla en Chrome, Edge o Firefox. No necesita internet ni servidor.
- **`modular/`** (`index.html` + `styles.css` + `app.js`): el mismo programa separado en archivos, para mantenerlo o migrarlo.
- **`src/`**: código fuente por módulos. Con `build.sh` se generan las dos versiones anteriores.

## Datos

- Se guardan en **IndexedDB** del navegador y del equipo donde se usa. Si IndexedDB no está disponible, se usa localStorage.
- Nada se envía a la red. Además, el archivo único lleva una política CSP que bloquea cualquier conexión.
- Cada navegador guarda sus propios datos. Para pasarlos a otro equipo o navegador, use **Datos → Exportar / Importar respaldo JSON**.
- Las entidades se guardan por separado para facilitar una futura migración a base de datos: `athletes`, `consents`, `injuries`, `evaluations`, `sessions`, `questionnaires`, `testSessions`, `trials`, `results`, `references`, `reports`, `documents` e `imports`. Las definiciones de prueba (`TestDefinition`) están en `src/js/04-tests.js`.

## Estructura del código (`src/js`)

| Archivo | Contenido |
|---|---|
| 00-core | Utilidades, almacenamiento (IndexedDB), respaldo, modales, formularios |
| 01-calc | Estadística y biomecánica: media, DE, CV, asimetría, LSI, RSI, RFD, impulso, Sdec, regresiones, potencia de Bosco, DSI, MDC, VO₂ estimado, análisis de señales fuerza–tiempo |
| 02-refs | Base de referencias tipificadas: punto de corte, referencia, MDC, MCID, SEM, método, fabricante |
| 03-questionnaires | LEFS, FAAM (AVD y Deporte), KOOS y OSTRC-H2 con su puntuación |
| 04-tests | Biblioteca de 33 pruebas con ficha completa |
| 05-diagrams | Diagramas SVG propios generados por código |
| 06-charts | Gráficos SVG sin librerías externas |
| 07-engine | Cálculo de resultados, lectura en tres niveles, alertas del check-in y fases |
| 08–13 | Vistas: panel, flujo, toma guiada, módulos, integración, evolución, informe, referencias y datos |


## Publicación en GitHub Pages

El repositorio está listo para GitHub Pages: `index.html` en la raíz es la aplicación completa en un solo archivo.

1. Cree un repositorio nuevo en GitHub, por ejemplo `lcm-athlete-lab`.
2. Suba el contenido de esta carpeta. Puede hacerlo desde la web con *Add file → Upload files* o con git:
   ```bash
   git remote add origin https://github.com/USUARIO/lcm-athlete-lab.git
   git push -u origin main
   ```
3. En *Settings → Pages*, elija *Deploy from a branch*, la rama `main` y la carpeta `/ (root)`.
4. La aplicación quedará disponible en `https://USUARIO.github.io/lcm-athlete-lab/`.

**Privacidad en GitHub:**

- En GitHub solo se publica el código. Los datos de los deportistas se siguen guardando en el navegador de cada equipo (IndexedDB) y nunca se envían a GitHub.
- No suba respaldos JSON ni informes PDF al repositorio. El archivo `.gitignore` ya los excluye.
- Los datos guardados al usar la versión publicada (`github.io`) están separados de los datos guardados al abrir el archivo local. Para pasar datos de una a otra, use **Exportar / Importar respaldo JSON**.

## Informes PDF

- **PDF de sesión:** al terminar todas las pruebas de una sesión, en *Toma guiada* aparece el bloque **Cierre de la sesión** con signos vitales post-sesión, RPE de la sesión y observaciones. Desde ahí se descarga el PDF.
- **PDF del informe integrado:** en *Informe → Descargar PDF*.
- Los PDF se generan en el navegador, sin internet ni librerías externas. Usan tablas abiertas (solo líneas horizontales) e incluyen la firma del evaluador registrada en el consentimiento.

## Signos vitales

En *Pretest* y en el *Cierre de la sesión* se registran: presión arterial sistólica y diastólica, frecuencia cardiaca, SpO₂, frecuencia respiratoria y temperatura. Para cada medición se anotan el momento (pre-sesión, entre pruebas, post-sesión, recuperación), la posición y el brazo.

Las alertas no son diagnósticos y combinan dos tipos de umbral:

- **Con referencia publicada:** PA en reposo > 200/110 mmHg, contraindicación relativa para pruebas de esfuerzo (Fletcher et al., 2013).
- **Operativos del laboratorio:** FC en reposo > 100 lpm, SpO₂ < 95 % y temperatura ≥ 37.5 °C.

La categoría de presión arterial (ACC/AHA 2017) solo se muestra en mediciones de reposo y como dato descriptivo.

## Qué no hace esta versión

- No se conecta en tiempo real con AMTI, Qualisys, InBody, encoders ni Polar. Los datos se ingresan a mano o se importan desde CSV/TSV exportados. Los saltos con dos plataformas AMTI se importan desde la exportación TSV de QTM con datos de fuerza (`*_f_1.tsv` + `*_f_2.tsv`) en **Módulos → Saltos AMTI (QTM)**, o directamente en cada intento de la toma guiada.
- No lee automáticamente el PDF ni la imagen del InBody (no hay OCR). El archivo se adjunta como documento.
- No lee formatos binarios (.qtm, .c3d).
- No sincroniza entre dispositivos ni tiene cuentas de usuario.
- No emite diagnósticos ni decisiones de aptitud o de retorno deportivo.
- Los ítems de los cuestionarios son una versión de trabajo en español. Para uso formal deben reemplazarse por las versiones validadas.
- Las citas y los DOI de la base de referencias deben verificarse antes de usarlos en publicaciones.
