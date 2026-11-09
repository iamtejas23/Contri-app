import base64,json,os,socket,struct,sys,urllib.request
expr=sys.argv[1]
page=json.load(urllib.request.urlopen('http://127.0.0.1:9222/json'))[0]; path=page['webSocketDebuggerUrl'].split('/devtools/page/')[-1]
s=socket.create_connection(('127.0.0.1',9222)); key=base64.b64encode(os.urandom(16)).decode(); s.sendall((f'GET /devtools/page/{path} HTTP/1.1\r\nHost: 127.0.0.1:9222\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n').encode()); response=b''
while b'\r\n\r\n' not in response: response+=s.recv(4096)
def send(obj):
 b=json.dumps(obj).encode(); mask=os.urandom(4); n=len(b); head=bytes([129,128|n]) if n<126 else bytes([129,128|126])+struct.pack('!H',n); s.sendall(head+mask+bytes(c^mask[i%4] for i,c in enumerate(b)))
def recv():
 h=s.recv(2); n=h[1]&127
 if n==126:n=struct.unpack('!H',s.recv(2))[0]
 elif n==127:n=struct.unpack('!Q',s.recv(8))[0]
 d=b''
 while len(d)<n:d+=s.recv(n-len(d))
 return h[0]&15,d
send({'id':1,'method':'Runtime.evaluate','params':{'expression':expr,'returnByValue':True}})
while True:
 op,data=recv()
 if op==1:
  msg=json.loads(data)
  if msg.get('id')==1:
   print(json.dumps(msg.get('result',{}).get('result',{}).get('value'),ensure_ascii=False)); break
s.close()
