import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
let html=readFileSync('dist/index.html','utf8');
html=html.replace(/<script[^>]*src="\.\/([^\"]+)"[^>]*><\/script>/,(_,path)=>'<script type="module">'+readFileSync('dist/'+path,'utf8').replace(/<\/script/gi,'<\\/script')+'</script>');
html=html.replace(/<link[^>]*rel="stylesheet"[^>]*href="\.\/([^\"]+)"[^>]*>/,(_,path)=>'<style>'+readFileSync('dist/'+path,'utf8')+'</style>');
html=html.replace(/href="\.\/assets\/favicon[^\"]+"/,'href="data:image/svg+xml,'+encodeURIComponent(readFileSync('favicon.svg','utf8'))+'"');
if(/(?:src|href)="\.\/assets\//.test(html))throw Error('Unbundled asset reference remains');
mkdirSync('docs',{recursive:true});writeFileSync('docs/index.html',html);writeFileSync('docs/.nojekyll','');console.log('GitHub Pages bundle created: docs/index.html');
