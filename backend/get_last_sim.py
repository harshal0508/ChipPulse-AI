import sqlite3, json, numpy as np

conn = sqlite3.connect('chippulse.db')
c = conn.cursor()
c.execute("SELECT thermal_map, ir_drop_map FROM simulations ORDER BY created_at DESC LIMIT 1")
row = c.fetchone()
if row:
    T = np.array(json.loads(row[0]))
    ir_drop = np.array(json.loads(row[1]))
    
    diff_x = np.abs(np.diff(T, axis=0))
    diff_y = np.abs(np.diff(T, axis=1))
    max_spatial_grad = max(float(np.max(diff_x)) if diff_x.size > 0 else 0, float(np.max(diff_y)) if diff_y.size > 0 else 0)
    score_grad = max(0.0, 100.0 - (max_spatial_grad / 15.0) * 100.0)
    
    max_ir_drop = float(np.max(ir_drop))
    score_ir = max(0.0, 100.0 - (max_ir_drop / 0.1) * 100.0)
    
    print(f"Max grad: {max_spatial_grad:.4f} -> Score Grad: {score_grad:.2f}")
    print(f"Max IR: {max_ir_drop:.4f} -> Score IR: {score_ir:.2f}")
