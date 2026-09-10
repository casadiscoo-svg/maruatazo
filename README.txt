MARUATAZO XII — V18 SEPARATED EDITORS

index.html = landing + tickets + lineup + merch + info + EDITAR WEB.
mapa.html = cabañas / mapa 3D + EDITAR MAPA + terreno + objetos + MAR/OLAS.

IMPORTANTE:
- El mundo 3D ya NO vive dentro de la landing. Esto evita que el editor web y el editor 3D compitan por clicks, canvas, scroll y selección.
- En la landing usa el botón “CABAÑAS + MAPA 3D” para abrir el mundo.
- El editor web se abre con “EDITAR WEB ✦”. Su panel se puede arrastrar desde el encabezado y redimensionar en escritorio.
- El editor del mundo sigue siendo independiente dentro de mapa.html.
- Los ajustes de ambos se guardan en localStorage por separado.

V24 STABLE EDITOR FIX
- Landing editor movement no longer changes the original CSS transform/positioning mode.
- Existing links/buttons are inert while EDITAR WEB is active.
- Drag offsets use independent translate/rotate/scale properties.
- New clean localStorage namespace avoids restoring corrupted geometry from older editor builds.
- Cmd+S / Ctrl+S + autosave remain enabled.
