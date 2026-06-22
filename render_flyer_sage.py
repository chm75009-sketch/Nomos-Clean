from PIL import Image, ImageDraw, ImageFont
W,H=1748,2480; M=140; CX=W//2
FB="/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
FR="/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"
def fb(s): return ImageFont.truetype(FB,s)
def fr(s): return ImageFont.truetype(FR,s)
# palette Manus (humaniste)
sage=(107,142,127); sage_d=(83,112,99); ochre=(196,149,107); ochre_d=(168,122,82)
off=(245,243,240); dark=(44,44,44); grey=(92,92,92); muted=(150,150,145)
coral=(206,108,95); coralbg=(255,232,224); sagebg=(229,242,237); white=(255,255,255); line=(228,226,221)
img=Image.new("RGB",(W,H),off); d=ImageDraw.Draw(img)
def tw(s,f): return d.textbbox((0,0),s,font=f)[2]
def th(s,f): b=d.textbbox((0,0),s,font=f); return b[3]-b[1]
def center(y,s,f,c): d.text((CX,y),s,font=f,fill=c,anchor="mm")
def left(x,y,s,f,c): d.text((x,y),s,font=f,fill=c,anchor="lm")
def wrap(s,f,maxw):
    out=[];ln=""
    for w in s.split():
        t=(ln+" "+w).strip()
        if tw(t,f)<=maxw: ln=t
        else: out.append(ln);ln=w
    if ln:out.append(ln)
    return out
def rrect(b,r,fill=None,outline=None,width=1): d.rounded_rectangle(b,radius=r,fill=fill,outline=outline,width=width)
def checkc(cx,cy,rad,bg,fg):
    d.ellipse([cx-rad,cy-rad,cx+rad,cy+rad],fill=bg)
    s=rad*0.55
    d.line([(cx-s,cy),(cx-s*0.2,cy+s*0.75),(cx+s,cy-s*0.7)],fill=fg,width=int(rad*0.22),joint="curve")

# ---------- HEADER ----------
y=120
# logo + wordmark + tagline (centré)
wm="NOMOS"; fwm=fb(54); logo=64; gap=22; tagw=0
gw=logo+gap+tw(wm,fwm); gx=CX-gw/2; gcy=y
d.ellipse([gx,gcy-logo/2,gx+logo,gcy+logo/2],fill=sage)
d.line([(gx+logo*0.30,gcy+logo*0.16),(gx+logo*0.30,gcy-logo*0.18),(gx+logo*0.70,gcy+logo*0.16),(gx+logo*0.70,gcy-logo*0.18)],fill=white,width=8,joint="curve")
left(gx+logo+gap,gcy,wm,fwm,sage)
center(y+62,"Hygiène alimentaire simplifiée",fr(28),muted)
# coral stat badge
y=y+150
bt="300 fermetures administratives en 2024"; fbd=fb(27)
bw=tw(bt,fbd)+120; bh=66; bx=CX-bw/2
rrect([bx,y,bx+bw,y+bh],bh/2,fill=coralbg)
# triangle warn
tx=bx+44; tcy=y+bh/2; ts=15
d.line([(tx-ts,tcy+ts*0.8),(tx+ts,tcy+ts*0.8),(tx,tcy-ts),(tx-ts,tcy+ts*0.8)],fill=coral,width=5,joint="curve")
d.text((tx,tcy-1),"!",font=fb(22),fill=coral,anchor="mm")
left(tx+34,tcy,bt,fbd,coral)
# title
y=y+bh+70
ftit=fb(96)
for ln in ["Évitez la fermeture","administrative"]:
    center(y,ln,ftit,dark); y+=104
# subtitle
y+=20
for ln in wrap("Soyez prêt quand l'inspecteur arrive. Prouvez votre conformité HACCP à chaque contrôle.",fr(34),W-2*M-40):
    center(y,ln,fr(34),grey); y+=48

# ---------- BENEFITS ----------
y+=40
benes=[("Relevés de température","Automatisés et conformes HACCP"),
       ("Plan de nettoyage","Traçabilité complète et documentée"),
       ("Audit qualité","Passez l'inspection avant l'inspecteur")]
for t,sub in benes:
    checkc(M+26,y,26,sage,white)
    left(M+70,y-16,t,fb(31),dark)
    left(M+70,y+20,sub,fr(26),grey)
    y+=92

# ---------- 2 APPS (compact) ----------
y+=18
cardw=(W-2*M-28)/2; cardh=120
for i,(name,desc,accent) in enumerate([("HACCP Pro","Registre, traçabilité & Pack DDPP",sage),
                                       ("Clean Food","Audit avant le contrôle",ochre)]):
    x0=M+i*(cardw+28)
    rrect([x0,y,x0+cardw,y+cardh],16,fill=white,outline=line,width=2)
    d.rounded_rectangle([x0,y,x0+10,y+cardh],radius=5,fill=accent)
    left(x0+34,y+44,name,fb(30),dark)
    left(x0+34,y+82,desc,fr(24),grey)
y+=cardh

# ---------- CTA (sage block) ----------
y+=44
cta_h=470; rrect([M,y,W-M,y+cta_h],26,fill=sage)
center(y+58,"Prêt à protéger votre établissement ?",fb(40),white)
# white inner card with QR + code
iy=y+104; ih=300; rrect([M+40,iy,W-M-40,iy+ih],18,fill=white)
qr=Image.open("qr_nomos.png").convert("RGB").resize((250,250))
img.paste(qr,(M+74,iy+25)); d=ImageDraw.Draw(img)
qx=M+74+250+44
left(qx,iy+58,"Essai gratuit 7 jours",fb(36),dark)
left(qx,iy+104,"Sans engagement · accès immédiat",fr(25),grey)
# code pill (ochre)
ct="Code d'accès : "; cv="HACCP7J"; fpl=fr(28); fpv=fb(34)
pw=36+tw(ct,fpl)+tw(cv,fpv)+36; ph=72; pyp=iy+150
rrect([qx,pyp,qx+pw,pyp+ph],ph/2,fill=ochre)
left(qx+30,pyp+ph/2,ct,fpl,(255,247,240))
left(qx+30+tw(ct,fpl),pyp+ph/2,cv,fpv,white)
left(qx,iy+260,"Scannez le QR ou entrez le code dans l'app",fr(23),grey)
y+=cta_h

# ---------- CONTACTS ----------
y+=70
center(y,"VOS CONTACTS",fb(28),ochre_d)
d.line([(CX,y+50),(CX,y+170)],fill=line,width=2)
y2=y+90
for cxc,name,role,phone,mail in [(M+(CX-M)/2,"Léa","Responsable commerciale","06 29 33 68 09","chikhaoui.lea@gmail.com"),
                                  (CX+(W-M-CX)/2,"Mounir","Support client","06 61 47 61 65","[e-mail de Mounir]")]:
    d.text((cxc,y2),name,font=fb(38),fill=dark,anchor="mm")
    d.text((cxc,y2+44),role,font=fr(24),fill=muted,anchor="mm")
    d.text((cxc,y2+88),phone,font=fb(34),fill=sage_d,anchor="mm")
    d.text((cxc,y2+128),mail,font=fr(23),fill=muted,anchor="mm")

# ---------- FOOTER ----------
d.rectangle([0,H-92,W,H],fill=(238,236,232))
fy=H-66
for ln in wrap("Source : France Bleu / ICI, 2024. Outils d'aide à la gestion et à la mise en conformité HACCP — ne remplacent ni l'obligation de formation, ni la mise en place d'un Plan de Maîtrise Sanitaire.",fr(19),W-2*M):
    center(fy,ln,fr(19),muted); fy+=26

img.save("flyer_nomos_sage.png","PNG")
img.save("flyer_nomos_sage.pdf","PDF",resolution=300.0)
print("✅ flyer_nomos_sage.png + .pdf générés")
