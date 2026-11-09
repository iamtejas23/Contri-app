import json, urllib.request, socket, base64, os, struct, sys
from urllib.parse import urlparse
items = json.load(urllib.request.urlopen('http://127.0.0.1:9222/json/list'))
target = next(x for x in items if x.get('type') == 'page')
u = urlparse(target['webSocketDebuggerUrl'])
s = socket.create_connection((u.hostname, u.port))
key = base64.b64encode(os.urandom(16)).decode()
s.sendall((f'GET {u.path} HTTP/1.1\r\nHost: {u.hostname}:{u.port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n').encode())
resp=b''
while b'\r\n\r\n' not in resp: resp += s.recv(4096)
if b'101' not in resp.split(b'\r\n',1)[0]: raise RuntimeError(resp.decode(errors='replace'))
def send(obj):
 d=json.dumps(obj).encode(); m=os.urandom(4); n=len(d); h=bytearray([0x81])
 if n<126:h.append(0x80|n)
 elif n<65536:h.append(0x80|126);h.extend(struct.pack('!H',n))
 else:h.append(0x80|127);h.extend(struct.pack('!Q',n))
 s.sendall(bytes(h)+m+bytes(b^m[i%4] for i,b in enumerate(d)))
def recv():
 h=s.recv(2); n=h[1]&127
 if n==126:n=struct.unpack('!H',s.recv(2))[0]
 elif n==127:n=struct.unpack('!Q',s.recv(8))[0]
 masked=h[1]>>7; m=s.recv(4) if masked else b'';d=b''
 while len(d)<n:d+=s.recv(n-len(d))
 if masked:d=bytes(b^m[i%4] for i,b in enumerate(d))
 if h[0]&15==9:s.sendall(bytes([0x8a,len(d)])+d);return recv()
 return json.loads(d)
def evaluate(expression):
 send({'id':1,'method':'Runtime.evaluate','params':{'expression':expression,'returnByValue':True,'awaitPromise':True}})
 while True:
  msg=recv()
  if msg.get('id')==1:
   result=msg.get('result',{}).get('result',{})
   if result.get('subtype')=='error':raise RuntimeError(result.get('description'))
   return result.get('value')
if len(sys.argv)>1: print(evaluate(sys.argv[1]))
s.close()
