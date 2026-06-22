from PIL import Image, ImageDraw, ImageFont

# ---------- A5 @300dpi ----------
W, H = 1748, 2480
M = 130
CX = W // 2
FB = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
FR = "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"
def fb(s): return ImageFont.truetype(FB, s)
def fr(s): return ImageFont.truetype(FR, s)

# ---------- palette ----------
navy=(28,25,72); navy2=(21,18,58); gold=(201,168,76); gold2=(232,201,122)
lav=(202,200,228); white=(255,255,255); green=(46,158,125); green2=(36,122,96)
ink=(28,34,48); sub=(92,98,115); muted=(150,156,170); line=(236,236,242); card=(251,251,253)
cream=(251,244,226); creaml=(240,230,201); pink=(107,86,24); pbold=(58,46,8)
blue=(58,99,196); lblue=(238,243,255); lgreen=(233,247,241)

img = Image.new("RGB",(W,H),white); d = ImageDraw.Draw(img)

def tw(s,f): return d.textbbox((0,0),s,font=f)[2]
def center(y,s,f,col):
    d.text((CX,y),s,font=f,fill=col,anchor="mm")
def spaced(y,s,f,col,sp,cx=CX):
    widths=[tw(c,f) for c in s]; total=sum(widths)+sp*(len(s)-1)
    x=cx-total/2
    for c,wc in zip(s,widths):
        d.text((x,y),c,font=f,fill=col,anchor="lm"); x+=wc+sp
def wrap(s,f,maxw):
    out=[]; ln=""
    for w in s.split():
        t=(ln+" "+w).strip()
        if tw(t,f)<=maxw: ln=t
        else: out.append(ln); ln=w
    if ln: out.append(ln)
    return out
def rrect(box,r,fill=None,outline=None,width=1):
    d.rounded_rectangle(box,radius=r,fill=fill,outline=outline,width=width)
def check(cx,cy,s,col,wd=6):
    d.line([(cx-s,cy),(cx-s*0.25,cy+s*0.7),(cx+s,cy-s*0.7)],fill=col,width=wd,joint="curve")

# ================= HEADER =================
HH=860
d.rectangle([0,0,W,HH],fill=navy)
# léger dégradé vertical
grad=Image.new("L",(1,HH))
for i in range(HH): grad.putpixel((0,i),int(18*(1-i/HH)))
over=Image.new("RGB",(W,HH),(70,60,140))
img.paste(Image.composite(over,Image.new("RGB",(W,HH),navy),grad.resize((W,HH))),(0,0))
d=ImageDraw.Draw(img)
# filet doré bas
d.rectangle([0,HH-8,W,HH],fill=gold)
# brand
wm="NOMOS"; fwm=fb(46); wmw=tw(wm,fwm); logo=58; gap=20
gw=logo+gap+wmw; gx=CX-gw/2; gcy=120
d.ellipse([gx,gcy-logo/2,gx+logo,gcy+logo/2],outline=gold2,width=6)
d.line([(gx+logo*0.30,gcy+logo*0.18),(gx+logo*0.30,gcy-logo*0.18),
        (gx+logo*0.70,gcy+logo*0.18),(gx+logo*0.70,gcy-logo*0.18)],fill=gold2,width=7,joint="curve")
d.text((gx+logo+gap,gcy),wm,font=fwm,fill=white,anchor="lm")
# kicker
spaced(208,"HACCP PRO  ·  CLEAN FOOD",fb(26),gold2,7)
# pretitle
spaced(268,"HYGIÈNE ALIMENTAIRE — ÉVITEZ LA",fr(30),lav,3)
# title
center(360,"FERMETURE",fb(132),white)
center(490,"ADMINISTRATIVE",fb(132),white)
# subtitle
center(600,"Prouvez votre conformité à chaque contrôle.",fr(36),lav)
# badges
def badge_w(txt): return 40+24+tw(txt,fb(24))+34
bd=[("Conforme DDPP"),("Hébergé en France"),("Sans engagement")]
fbd=fb(24); gapb=22
ws=[badge_w(t) for t in bd]; tot=sum(ws)+gapb*2; bx=CX-tot/2; by=690; bh=58
for t,wbox in zip(bd,ws):
    rrect([bx,by,bx+wbox,by+bh],bh/2,outline=gold2,width=3)
    check(bx+34,by+bh/2,12,gold2,5)
    d.text((bx+34+22,by+bh/2),t,font=fbd,fill=gold2,anchor="lm")
    bx+=wbox+gapb

# ================= PROOF =================
PY0=HH; PH=190
d.rectangle([0,PY0,W,PY0+PH],fill=cream)
d.rectangle([0,PY0+PH-2,W,PY0+PH],fill=creaml)
# warning triangle
tx,ty=M+18,PY0+PH/2; ts=30
d.line([(tx-ts,ty+ts*0.8),(tx+ts,ty+ts*0.8),(tx,ty-ts*0.9),(tx-ts,ty+ts*0.8)],fill=(185,133,26),width=6,joint="curve")
d.text((tx,ty-2),"!",font=fb(34),fill=(185,133,26),anchor="mm")
proof=[("~300 fermetures administratives en 2024",True),
       ("(Seine-Saint-Denis, ~3 000 contrôles, +80 vs 2023). Un relevé",False),
       ("manquant suffit. Soyez prêt avant l'inspecteur.",False)]
px=M+90; py=PY0+44; fpb=fb(28); fpr=fr(28)
d.text((px,py),"~300 fermetures administratives en 2024",font=fpb,fill=pbold,anchor="lm"); py+=46
d.text((px,py),"(Seine-Saint-Denis, ~3 000 contrôles, +80 vs 2023). Un relevé manquant",font=fpr,fill=pink,anchor="lm"); py+=42
d.text((px,py),"suffit. ",font=fpr,fill=pink,anchor="lm")
xx=px+tw("suffit. ",fpr)
d.text((xx,py),"Soyez prêt avant l'inspecteur.",font=fpb,fill=pbold,anchor="lm")

# ================= BODY =================
BY=PY0+PH+70
# --- app cards ---
cardw=(W-2*M-30)/2; cardh=230; cy0=BY
for i,(cls,name,desc,bubble_bg,bubble_st) in enumerate([
    ("h","HACCP Pro","Relevés & traçabilité au quotidien. Pack DDPP prêt en 30 s, même hors-ligne.",lblue,blue),
    ("c","Clean Food","Audit guidé : passez l'inspection avant l'inspecteur et corrigez à temps.",lgreen,green2)]):
    x0=M+i*(cardw+30); 
    rrect([x0,cy0,x0+cardw,cy0+cardh],20,fill=card,outline=line,width=2)
    bb=54; bx0=x0+28; by0=cy0+26
    rrect([bx0,by0,bx0+bb,by0+bb],14,fill=bubble_bg)
    check(bx0+bb/2,by0+bb/2,15,bubble_st,7)
    d.text((bx0+bb+18,by0+bb/2),name,font=fb(32),fill=ink,anchor="lm")
    ty2=by0+bb+24
    for ln in wrap(desc,fr(25),cardw-56):
        d.text((x0+28,ty2),ln,font=fr(25),fill=sub,anchor="lm"); ty2+=36

# --- QR box ---
qy0=cy0+cardh+45; qbh=360
rrect([M,qy0,W-M,qy0+qbh],22,fill=card,outline=line,width=2)
qr=Image.open("qr_nomos.png").convert("RGB").resize((300,300))
img.paste(qr,(M+34,qy0+30)); d=ImageDraw.Draw(img)
qx=M+34+300+44
def spaced_left(x,y,s,f,col,sp):
    for c in s:
        d.text((x,y),c,font=f,fill=col,anchor="lm"); x+=tw(c,f)+sp
spaced_left(qx,qy0+44,"ESSAI GRATUIT · 3 JOURS",fb(22),muted,3)
d.text((qx,qy0+96),"Scannez & testez",font=fb(34),fill=ink,anchor="lm")
d.text((qx,qy0+140),"sans engagement",font=fb(34),fill=ink,anchor="lm")
# green code pill
ct="Code d'accès : "; cv="HACCP3J"
fpl=fr(28); fpv=fb(32)
pillw=40+tw(ct,fpl)+tw(cv,fpv)+40; pillh=70; pxp=qx; pyp=qy0+196
rrect([pxp,pyp,pxp+pillw,pyp+pillh],pillh/2,fill=green)
d.text((pxp+34,pyp+pillh/2),ct,font=fpl,fill=(235,255,247),anchor="lm")
d.text((pxp+34+tw(ct,fpl),pyp+pillh/2),cv,font=fpv,fill=white,anchor="lm")
d.text((qx,qy0+300),"Appareil photo : visez le QR code",font=fr(24),fill=muted,anchor="lm")

# --- contacts ---
sy=qy0+qbh+70
# separator
sep="VOS CONTACTS"; fsep=fb(26); sw=tw(sep,fsep)+40
spaced(sy,sep,fsep,gold,6)
d.line([(M,sy),(CX-sw/2,sy)],fill=line,width=2)
d.line([(CX+sw/2,sy),(W-M,sy)],fill=line,width=2)
cyc=sy+90
d.line([(CX,cyc-30),(CX,cyc+70)],fill=line,width=2)
for cxc,name,phone,mail in [(M+(CX-M)/2,"Léa","06 29 33 68 09","chikhaoui.lea@gmail.com"),
                            (CX+(W-M-CX)/2,"Mounir","06 61 47 61 65","[e-mail de Mounir]")]:
    d.text((cxc,cyc),name,font=fb(36),fill=ink,anchor="mm")
    d.text((cxc,cyc+46),phone,font=fb(36),fill=green2,anchor="mm")
    d.text((cxc,cyc+92),mail,font=fr(24),fill=muted,anchor="mm")

# ================= FOOTER =================
d.rectangle([0,H-90,W,H],fill=(250,250,251))
d.line([(0,H-90),(W,H-90)],fill=line,width=2)
foot="Source fermetures : France Bleu / ICI, 2024. Outils d'aide à la gestion et à la mise en conformité HACCP — ne remplacent ni l'obligation de formation, ni la mise en place d'un Plan de Maîtrise Sanitaire."
fy=H-66
for ln in wrap(foot,fr(19),W-2*M):
    d.text((CX,fy),ln,font=fr(19),fill=(170,176,187),anchor="mm"); fy+=26

img.save("flyer_nomos.png","PNG")
img.save("flyer_nomos.pdf","PDF",resolution=300.0)
print("✅ Généré flyer_nomos.png + flyer_nomos.pdf")
