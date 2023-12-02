//
// Grist
//

// 初期化
grist.ready({
    requiredAccess: 'full',
    columns: [
        { name: 'Content', type: 'Text' },
        { name: 'AnswerHistory', type: 'Text' }
    ],
});

let lastSave = null; // 保存中かを判別するため
let recordId = null;
let contentColumnName = null;
const gristReadOnlyModeId = "my-lock-id";  // 読み込み専用モード時の
// 解答履歴
let answerHistoryColumnName = null;
// 履歴データ
let answerHistory = null;

// CKEditor の内容を Grist へ保存する
function saveMarkdwonToGrist(content) {
    if (lastSave) { // 保存作業が未完了の場合は何もしない
        return;
    }

    const table = grist.getTable?.();
    if (table && recordId && contentColumnName) {  // 未作成のレコードにフォーカスした後などは保存出来ないように
        lastSave = table.update({
            id: recordId,
            fields: {
                [contentColumnName]: content
            }
        }).finally(() => { lastSave = null })
    }
}

// 未作成のレコードにフォーカスした場合
grist.onNewRecord(function () {
    // 前回最後のコンテンツを保存する
    saveMarkdwonToGrist(editor.getData())

    recordId = null;
    contentColumnName = null;
    answerHistoryColumnName = null
    answerHistory = null;

    if (window.editor) {
        window.editor.setData("")
        window.editor.enableReadOnlyMode(gristReadOnlyModeId)  // 読み込み専用に
    }
})

// 別の作成済みのレコードに移動した場合
grist.onRecord(function (record, mappings) {
    if (!window.editor) { return; }

    // If this is a new record, or mapping is diffrent.
    if (recordId !== record.id || mappings?.Content !== contentColumnName) {
        // 別の行に移動した場合は前回最後のコンテンツを保存する
        saveMarkdwonToGrist(editor.getData())

        // 新しい行での初期作業
        recordId = record.id;
        contentColumnName = mappings?.Content;
        answerHistoryColumnName = mappings?.AnswerHistory
        // 解答ボタンとエディタを非表示
        const answerContainer = document.getElementById('answerContainer');
        answerContainer.classList.add('invisible');

        const mapped = grist.mapColumnNames(record);
        if (!mapped) {
            // Log but don't bother user - maybe we are just testing.
            console.error('Please map columns');
        } else {
            // 解答履歴
            answerHistory = prepareAnswerHistory(mapped.AnswerHistory)
            // エディタ
            window.editor.setData(mapped.Content)
            if (window.editor.isReadOnly) {
                window.editor.disableReadOnlyMode(gristReadOnlyModeId)  // 読み込み専用解除
            }
        }
    }
});

// CKEditor
// Watchdog プラグインを有効化したので
const watchdog = new CKSource.EditorWatchdog();
window.watchdog = watchdog;

watchdog.setCreator((element, config) => {
    return CKSource.Editor
        .create(element, config)
        .then(editor => {
            window.editor = editor;
            return editor;
        });
});

watchdog.setDestructor(editor => {
    return editor.destroy();
});

watchdog.on('error', handleSampleError);

watchdog
    .create(document.querySelector('.editor'), {
        // Editor configuration.
        autosave: {
            save(editor) {
                saveMarkdwonToGrist(editor.getData())
            }
        }
    })
    .catch(handleSampleError);

function handleSampleError(error) {
    const issueUrl = 'https://github.com/ckeditor/ckeditor5/issues';

    const message = [
        'Oops, something went wrong!',
        `Please, report the following error on ${issueUrl} with the build id "hajmu1v19hdp-nczl19pfowvq" and the error stack trace:`
    ].join('\n');

    console.error(message);
    console.error(error);
}

//
// 解答履歴 処理
//
// 正解、不正解ボタン
const correctButton = document.querySelector("#correctButton")
const wrongButton = document.querySelector("#wrongButton")
correctButton.addEventListener('click', function () {
    console.log("correct")
    addAnswerLog(answerHistory, "correct")
    saveAnswerHistoryToGrist()
});
wrongButton.addEventListener('click', function () {
    console.log("answer")
    addAnswerLog(answerHistory, "wrong")
    saveAnswerHistoryToGrist()
});

// 読み込んだ解答履歴テキストをパースする（存在しなければ初期化）
function prepareAnswerHistory(rawData) {
    if (rawData === null || rawData.trim() === "") {
        rawData = "{}"
    }
    try {
        return JSON.parse(rawData)
    } catch (error) {
        console.error(error)
    }
}

function addAnswerLog(history, result) {
    if (!history) {
        console.error("History が空")
        return
    }

    if (!history.hasOwnProperty("AnswerLogs")) {
        history["AnswerLogs"] = []
    }

    const ut = parseInt(new Date().getTime() / 1000)  // Python 対応
    history["AnswerLogs"].push({ "datetime": ut, result })
}

// 解答履歴を Grist に保存する
function saveAnswerHistoryToGrist() {
    const table = grist.getTable?.();
    if (table && recordId && contentColumnName) {  // 未作成のレコードにフォーカスした後などは保存出来ないように
        lastSave = table.update({
            id: recordId,
            fields: {
                [answerHistoryColumnName]: JSON.stringify(answerHistory)
            }
        }).finally(() => { })
    }
}