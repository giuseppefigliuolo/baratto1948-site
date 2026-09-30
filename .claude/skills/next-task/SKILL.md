---
name: next-task
description: Prende la prossima issue GitHub con label "claude" e "todo", la implementa su un branch e apre una PR. Usare quando l'utente chiede di prendere/fare il prossimo task, o passa un numero di issue.
---

# next-task

Argomento opzionale: numero di issue. Senza argomento, prendi la più vecchia con label `todo`.

1. Scegli la issue: `gh issue list --label claude --label todo --state open --sort created --order asc --limit 1 --json number,title,body` (oppure `gh issue view <N>`). Se non ce ne sono, dillo e fermati.
2. Se la descrizione è ambigua in modo sostanziale, commenta sulla issue con la domanda (`gh issue comment`) e fermati; non indovinare.
3. Segna come in corso: `gh issue edit <N> --add-label doing --remove-label todo` e sposta la card: `.claude/skills/next-task/move-card.sh <N> "In progress"`.
4. Parti da main aggiornato: `git switch main && git pull --ff-only && git switch -c task/<N>-<slug-breve>`.
5. Implementa. Rispetta lo stile del codice esistente (Astro, variabili fluid typography/spacing già presenti). Non toccare `assets/` e `source-photos/`.
6. Verifica: `npm run check` e `npm run build` devono passare. Per modifiche visive, avvia `npm run dev` e controlla.
7. Commit con messaggio chiaro, poi `git push -u origin HEAD`.
8. Apri la PR: `gh pr create --title "<titolo>" --body "Closes #<N>\n\n<riassunto e come verificare>"`. Non fare merge: lo fa l'utente.
9. Sposta la issue in review: `gh issue edit <N> --add-label review --remove-label doing` e `.claude/skills/next-task/move-card.sh <N> "In review"`. La colonna Done si sposta da sola alla chiusura della issue (merge della PR).
10. Riporta all'utente il link della PR e cosa hai verificato (o non potuto verificare).

Se qualcosa fallisce, rimetti la label `todo` (e la card in `Ready`), commenta il motivo sulla issue e riferisci l'errore.
