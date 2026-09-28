"""Publica a KUSSUMBA no GitHub Pages, no ramo gh-pages.

Uso:  python publicar.py ["linha extra para a mensagem do registo" ...]

Publica só os ficheiros da aplicação, tirados do último registo (commit) do ramo main.
Os testes, as ferramentas e a documentação não são publicados (auditoria SEC-010).

Recusa publicar se:
- houver alterações por registar (o que se publica tem de estar guardado no main);
- a VERSAO do sw.js for igual à da última publicação (os telefones não receberiam a versão nova).
"""
import os
import pathlib
import re
import subprocess
import sys
import tempfile

PASTA = pathlib.Path(__file__).resolve().parent
PUBLICAR = ("index.html", "manifest.webmanifest", "sw.js", "css/", "fontes/", "icones/", "js/")
RAMO = "gh-pages"
ENDERECO = "https://ladislaulucala-sys.github.io/kussumba/"


def git(*argumentos, entrada=None, ambiente=None, obrigatorio=True):
    resultado = subprocess.run(["git", *argumentos], cwd=PASTA, capture_output=True, text=True,
                               input=entrada, env=ambiente, encoding="utf-8")
    if obrigatorio and resultado.returncode != 0:
        sys.exit(f"Falhou: git {' '.join(argumentos)}\n{resultado.stderr.strip()}")
    return resultado.stdout.strip() if resultado.returncode == 0 else None


def versao_em(referencia):
    texto = git("show", f"{referencia}:sw.js", obrigatorio=False)
    encontrada = re.search(r"const VERSAO = '([^']+)'", texto or "")
    return encontrada.group(1) if encontrada else None


def main():
    if git("status", "--porcelain"):
        sys.exit("Há alterações por registar. Faz primeiro o registo (commit) e o envio do ramo main.")
    git("fetch", "origin")
    if git("rev-parse", "main") != git("rev-parse", "origin/main", obrigatorio=False):
        sys.exit("O ramo main ainda não foi enviado para o GitHub. Faz primeiro: git push origin main")

    nova = versao_em("main")
    publicada = versao_em(f"origin/{RAMO}")
    if not nova:
        sys.exit("Não encontrei a VERSAO no sw.js.")
    if nova == publicada:
        sys.exit(f"A VERSAO do sw.js ({nova}) é igual à publicada. Muda-a antes de publicar.")

    # Índice temporário: só os ficheiros da aplicação, sem tocar na pasta de trabalho.
    with tempfile.TemporaryDirectory() as pasta_temporaria:
        ambiente = {**os.environ, "GIT_INDEX_FILE": str(pathlib.Path(pasta_temporaria) / "indice")}
        git("read-tree", "main", ambiente=ambiente)
        todos = git("ls-files", ambiente=ambiente).splitlines()
        retirar = [f for f in todos if not (f in PUBLICAR or f.startswith(tuple(p for p in PUBLICAR if p.endswith("/"))))]
        if retirar:
            git("rm", "--cached", "--quiet", "--", *retirar, ambiente=ambiente)
        # .nojekyll: o GitHub Pages publica os ficheiros tal como estão, sem os processar.
        vazio = git("hash-object", "-w", "--stdin", entrada="")
        git("update-index", "--add", "--cacheinfo", f"100644,{vazio},.nojekyll", ambiente=ambiente)
        arvore = git("write-tree", ambiente=ambiente)

    origem = git("rev-parse", "--short", "main")
    mensagem = "\n\n".join([f"Publicar {nova} (main {origem})", *sys.argv[1:]])
    anterior = git("rev-parse", "--verify", "--quiet", f"origin/{RAMO}", obrigatorio=False)
    pais = ["-p", anterior] if anterior else []
    registo = git("commit-tree", arvore, *pais, entrada=mensagem)
    git("update-ref", f"refs/heads/{RAMO}", registo)
    git("push", "origin", RAMO)
    print(f"Publicada a versão {nova}. Daqui a um ou dois minutos estará em {ENDERECO}")


if __name__ == "__main__":
    main()
