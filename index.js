// @ts-check

(async function () {

    /**
     * @param {string} url 
     */
    const getText = async url => {
        const r = await fetch(url, { cache: "no-cache" });
        return await r.text();
    };

    /**
     * 转义
     * @param {string} sql 
     */
    const escapeSQLite = sql => {
        return sql.replace(/\\'/g, "''");
    };

    let results = {};

    const exportJson = () => {
        if (!results || Object.keys(results).length === 0) return;
        const json = JSON.stringify(results);
        const blob = new Blob([json], { type: "application/json;charset=utf-8" });
        // @ts-ignore
        saveAs(blob, "results.json");
    };

    const exportBtn = document.getElementById("export-btn");
    exportBtn.onclick = () => exportJson();

    let resourceLoaded = 0;
    const resourceNumberEl = document.getElementById("resource-number");
    const resourceNumber = +resourceNumberEl.textContent;
    const resourceLoadedEl = document.getElementById("resource-loaded");
    const progressBarEl = document.getElementById("progress-bar");
    const resourceLoadedAdd = () => {
        resourceLoaded++;
        resourceLoadedEl.innerText = "" + resourceLoaded;
        progressBarEl.style.width = `${resourceLoaded / resourceNumber * 100}%`;

        console.log(progressBarEl.style.width);

        if (resourceLoaded >= resourceNumber) {
            const loadingEl = document.getElementById("loading");
            loadingEl.style.display = "none";

            const loadedEl = document.getElementById("loaded");
            loadedEl.style.display = "";
        }
    };

    const worker = new Worker("lib/worker.sql-memory-growth.js");
    worker.onerror = e => console.log("Worker error: ", e);

    // init
    worker.postMessage({
        id: 0,
        action: "open"
    });
    await new Promise(resolve => {
        worker.onmessage = resolve;
    });

    const fullSQL = await getText("https://cdn.jsdelivr.net/gh/pin-cong/data@master/pink.sql");
    resourceLoadedAdd();

    const tables = await getText("./tables.sql");
    const tableList = tables.split(/(?:\r?\n){2}/);
    resourceLoadedAdd();

    const exp = /\nLOCK TABLES `.+` WRITE;\n|\nUNLOCK TABLES;\n/;
    const dataList = fullSQL.split(exp).filter((data, index) => index % 2 == 1);

    const tableNameExp = /INSERT INTO `(.+)` VALUES/;
    const tableNameExp2 = /CREATE TABLE (?:`|")(.+)(?:`|") \(/;

    dataList.forEach(async (data, index) => {
        const sql = tableList[index] + "\n" + data;

        const tableName = sql.match(tableNameExp) && sql.match(tableNameExp)[1];

        const sqlLines = escapeSQLite(sql).split(/;\r?\n/);

        await Promise.all(
            sqlLines.map((s, i) => {
                const id = `${index}-${i}`;
                worker.postMessage({
                    id,
                    action: "exec",
                    sql: s
                });
                return new Promise(resolve => {
                    const cb = e => {
                        if (e.data.id === id) {
                            worker.removeEventListener("message", cb);
                            resolve();
                        }
                    };
                    worker.addEventListener("message", cb);
                });
            })
        );

        resourceLoadedAdd();

        if (tableName) {
            const messageId = `${index}-SELECT`;
            worker.postMessage({
                messageId,
                action: "exec",
                sql: `SELECT * FROM ${tableName}`
            });

            await new Promise(resolve => {
                const cb = e => {
                    if (e.data.id === undefined) {
                        worker.removeEventListener("message", cb);
                        results[tableName] = e.data.results[0];
                        resolve();
                    }
                };
                worker.addEventListener("message", cb);
            });
        } else {
            const tableName = sql.match(tableNameExp2)[1];
            results[tableName] = null;
        }

        resourceLoadedAdd();

    })

})();
