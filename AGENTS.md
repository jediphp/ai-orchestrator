Before writing code always:

1. Read existing project structure.

2. Do not modify unrelated files.

3. Never rename files unless required.

4. Never rewrite entire modules if small change is enough.

5. Preserve TypeScript strict compatibility.

6. Reuse existing code whenever possible.

7. Never add dependencies unless required.

8. Do not refactor unrelated code.

9. Do not create duplicate utilities.

10. Keep changes minimal.

11. После любых больших изменений обновляй документацию SETUP.md

12. Для каждой новой задачи создавай отдельную ветку от актуальной `main`.

13. Называй рабочие ветки с понятным типом изменения: `feature/...`, `hotfix/...`, `bugfix/...`, `docs/...`, `test/...`, `chore/...` или `refactor/...`.

14. После завершения работы вливай рабочую ветку обратно в `main` через merge, затем пушь обновлённую `main`.
