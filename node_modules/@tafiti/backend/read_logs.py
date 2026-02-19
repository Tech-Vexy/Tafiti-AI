import sys

def read_log(filename):
    try:
        # Try different encodings
        for encoding in ['utf-16', 'utf-16-le', 'utf-8', 'latin-1']:
            try:
                with open(filename, 'r', encoding=encoding) as f:
                    content = f.read()
                    if content:
                        print(f"--- Log Content ({encoding}) ---")
                        # Print last 100 lines
                        lines = content.splitlines()
                        for line in lines[-100:]:
                            print(line)
                        return
            except Exception:
                continue
        print("Could not read log with tried encodings.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    read_log('server_debug.log')
