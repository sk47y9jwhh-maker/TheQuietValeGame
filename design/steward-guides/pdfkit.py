"""Small helpers: CMYK conversion and PDFs that reuse one image XObject per unique design."""
import io, math
import numpy as np, pikepdf
from PIL import Image, ImageCms
FOGRA='/usr/share/texlive/texmf-dist/tex/generic/colorprofiles/FOGRA39L_coated.icc'
MM=72/25.4
_srgb=ImageCms.createProfile('sRGB'); _cmyk=ImageCms.getOpenProfile(FOGRA)
_tf=ImageCms.buildTransform(_srgb,_cmyk,'RGB','CMYK',renderingIntent=ImageCms.Intent.RELATIVE_COLORIMETRIC)
def to_cmyk(rgb, src_icc=None):
    if src_icc:
        tf=ImageCms.buildTransform(ImageCms.ImageCmsProfile(io.BytesIO(src_icc)),_cmyk,'RGB','CMYK',renderingIntent=ImageCms.Intent.RELATIVE_COLORIMETRIC)
        return ImageCms.applyTransform(rgb.convert('RGB'),tf)
    return ImageCms.applyTransform(rgb.convert('RGB'),_tf)
def jpeg_bytes(cmyk, q=90):
    b=io.BytesIO(); cmyk.save(b,'JPEG',quality=q,subsampling=0,dpi=(600,600)); return b.getvalue()
def tac(cmyk):
    a=np.asarray(cmyk).astype(np.uint16).sum(axis=2)/2.55; return float(np.percentile(a,99.99)), float(a.max())
class Doc:
    def __init__(self, title):
        self.pdf=pikepdf.new(); self.pdf.docinfo['/Title']=title; self.pdf.docinfo['/Creator']='The Quiet Vale Hayman print pack'
        self.images={}; self.cut=None
    def image(self, key, jpg, w, h):
        if key not in self.images:
            s=pikepdf.Stream(self.pdf, jpg); s.Type=pikepdf.Name.XObject; s.Subtype=pikepdf.Name.Image
            s.Width=w; s.Height=h; s.ColorSpace=pikepdf.Name.DeviceCMYK; s.BitsPerComponent=8
            s.Filter=pikepdf.Name.DCTDecode; s.Decode=pikepdf.Array([1,0,1,0,1,0,1,0])
            self.images[key]=self.pdf.make_indirect(s)
        return self.images[key]
    def cutcontour(self):
        if self.cut is None:
            fn=pikepdf.Dictionary(FunctionType=2,Domain=[0,1],C0=[0,0,0,0],C1=[0,1,0,0],N=1)
            self.cut=self.pdf.make_indirect(pikepdf.Array([pikepdf.Name.Separation,pikepdf.Name('/CutContour'),pikepdf.Name.DeviceCMYK,fn]))
        return self.cut
    def page(self, wmm, hmm, key=None, trim=None, cut_path=None):
        W,H=wmm*MM,hmm*MM; ops=[]; res=pikepdf.Dictionary()
        if key is not None:
            res.XObject=pikepdf.Dictionary({'/Im0':self.images[key]}); ops.append(f'q {W:.4f} 0 0 {H:.4f} 0 0 cm /Im0 Do Q')
        if cut_path:
            res.ColorSpace=pikepdf.Dictionary({'/CS0':self.cutcontour()})
            pts=' '.join(f'{x*MM:.4f} {y*MM:.4f} {"m" if i==0 else "l"}' for i,(x,y) in enumerate(cut_path))
            ops.append(f'q /CS0 CS 1 SCN 0.25 w 1 j {pts} h S Q')
        content=pikepdf.Stream(self.pdf,('\n'.join(ops)).encode())
        pg=pikepdf.Dictionary(Type=pikepdf.Name.Page,MediaBox=[0,0,W,H],BleedBox=[0,0,W,H],Resources=res,Contents=self.pdf.make_indirect(content))
        if trim: x0,y0,x1,y1=trim; pg.TrimBox=[x0*MM,y0*MM,x1*MM,y1*MM]
        self.pdf.pages.append(pikepdf.Page(pg))
    def save(self, path): self.pdf.save(path, compress_streams=True)
def hexpath(cx,cy,R):
    return [(cx+R*math.cos(k*math.pi/3), cy+R*math.sin(k*math.pi/3)) for k in range(6)]
