import re

filepath = r'c:\pawan\backend\app\Http\Controllers\Api\AuditController.php'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

old = """        // Filter by action
        if ($action = $request->get('action')) {
            $query->where('action', $action);
        }"""

new = """        // Filter by action
        // Transaction-type actions (redemption, renewal, etc.) are stored as
        // action='create' + module='redemption', so map them correctly
        if ($action = $request->get('action')) {
            $moduleActions = [
                'redemption' => ['action' => 'create', 'module' => 'redemption'],
                'renewal' => ['action' => 'create', 'module' => 'renewal'],
                'pledge_create' => ['action' => 'create', 'module' => 'pledge'],
                'pledge_update' => ['action' => 'update', 'module' => 'pledge'],
                'forfeit' => ['action' => 'create', 'module' => 'auction'],
                'auction' => ['action' => 'create', 'module' => 'auction'],
            ];

            if (isset($moduleActions[$action])) {
                $mapping = $moduleActions[$action];
                $query->where('action', $mapping['action'])
                      ->where('module', $mapping['module']);
            } else {
                $query->where('action', $action);
            }
        }"""

if old in content:
    content = content.replace(old, new)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print("SUCCESS: File updated!")
else:
    # Try with \r\n
    old_crlf = old.replace('\n', '\r\n')
    new_crlf = new.replace('\n', '\r\n')
    if old_crlf in content:
        content = content.replace(old_crlf, new_crlf)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print("SUCCESS: File updated (CRLF)!")
    else:
        print("ERROR: Target content not found!")
        # Show what's around "Filter by action"
        idx = content.find('Filter by action')
        if idx >= 0:
            print(f"Found at index {idx}")
            print(repr(content[idx:idx+200]))
        else:
            print("'Filter by action' not found at all!")
