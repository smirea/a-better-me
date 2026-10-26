// Paints opaque boxes over owner data (weights, foods, dates) before a screenshot is committed.
// Usage: redact <in.jpg> <out.jpg> x1,y1,x2,y2 [...]   (pixel coordinates of the input image)
import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

let a = CommandLine.arguments
let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: a[1]) as CFURL, nil)!
let img = CGImageSourceCreateImageAtIndex(src, 0, nil)!
let w = img.width, h = img.height
let ctx = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: 0,
                    space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
ctx.draw(img, in: CGRect(x: 0, y: 0, width: w, height: h))
ctx.setFillColor(CGColor(red: 0.45, green: 0.2, blue: 0.5, alpha: 1))
for r in a.dropFirst(3) {
    let v = r.split(separator: ",").map { CGFloat(Double($0)!) }
    ctx.fill(CGRect(x: v[0], y: CGFloat(h) - v[3], width: v[2] - v[0], height: v[3] - v[1]))
}
let dst = CGImageDestinationCreateWithURL(URL(fileURLWithPath: a[2]) as CFURL, UTType.jpeg.identifier as CFString, 1, nil)!
CGImageDestinationAddImage(dst, ctx.makeImage()!, [kCGImageDestinationLossyCompressionQuality: 0.85] as CFDictionary)
CGImageDestinationFinalize(dst)
