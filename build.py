import pathlib
d=pathlib.Path(__file__).parent/'src'
js='\n'.join((d/f).read_text() for f in ['core.js','app.js','staff.js','student.js','comm.js','roster.js','pdfimport.js','perform.js','seed.js'])
html=(d/'head.html').read_text()+(d/'style.css').read_text()+'</style>\n</head>\n<body>\n<div id="app"></div><div id="ov-root"></div>\n<script>\n(()=>{\n'+js+'\n})();\n</script>\n</body>\n</html>\n'
out=pathlib.Path(__file__).parent/'site'/'index.html'; out.write_text(html); print(len(html))
