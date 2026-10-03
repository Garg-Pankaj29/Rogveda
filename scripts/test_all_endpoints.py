import json
import urllib.request
import urllib.error

def test_endpoints():
    url = "http://127.0.0.1:8000/api/molecule/predict-all"
    # Rotenone SMILES - known active for Tox21 MMP
    data = json.dumps({"smiles": "C=C(C)[C@H]1Cc2c(ccc3c2O[C@@H]2COc4cc(OC)c(OC)cc4[C@@H]2C3=O)O1"}).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    
    try:
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode())
            print("API Response:")
            print(json.dumps(result, indent=2))
            
            all_available = True
            for r in result:
                if not r.get("available"):
                    print(f"FAILED: {r.get('endpoint_name')} is not available!")
                    all_available = False
            
            if all_available:
                print("\nSUCCESS: All endpoints are available and functioning.")
            else:
                print("\nWARNING: Some endpoints are not available.")
                
    except urllib.error.URLError as e:
        print(f"Error calling API: {e}")

if __name__ == "__main__":
    test_endpoints()
