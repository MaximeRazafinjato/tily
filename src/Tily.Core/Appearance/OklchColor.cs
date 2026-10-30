namespace Tily.Core.Appearance;

public readonly record struct OklchColor(double Lightness, double Chroma, double Hue)
{
    private const int GamutSearchSteps = 24;
    private const double GamutTolerance = 0.000001;

    public static OklchColor FromHex(string hex)
    {
        var (red, green, blue) = HexColor.Channels(hex);
        var linearRed = ToLinear(red);
        var linearGreen = ToLinear(green);
        var linearBlue = ToLinear(blue);
        var l = Math.Cbrt(0.4122214708 * linearRed + 0.5363325363 * linearGreen + 0.0514459929 * linearBlue);
        var m = Math.Cbrt(0.2119034982 * linearRed + 0.6806995451 * linearGreen + 0.1073969566 * linearBlue);
        var s = Math.Cbrt(0.0883024619 * linearRed + 0.2817188376 * linearGreen + 0.6299787005 * linearBlue);
        var lightness = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
        var a = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
        var b = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
        var hue = Math.Atan2(b, a) * 180 / Math.PI;
        return new OklchColor(lightness, Math.Sqrt(a * a + b * b), hue < 0 ? hue + 360 : hue);
    }

    public string ToHex()
    {
        var rgb = ToLinearRgb(Chroma);
        if (!InGamut(rgb))
        {
            var low = 0.0;
            var high = Chroma;
            for (var step = 0; step < GamutSearchSteps; step++)
            {
                var middle = (low + high) / 2;
                if (InGamut(ToLinearRgb(middle)))
                {
                    low = middle;
                }
                else
                {
                    high = middle;
                }
            }

            rgb = ToLinearRgb(low);
        }

        return $"#{Encode(rgb.Red):x2}{Encode(rgb.Green):x2}{Encode(rgb.Blue):x2}";
    }

    private (double Red, double Green, double Blue) ToLinearRgb(double chroma)
    {
        var radians = Hue * Math.PI / 180;
        var a = chroma * Math.Cos(radians);
        var b = chroma * Math.Sin(radians);
        var l = Math.Pow(Lightness + 0.3963377774 * a + 0.2158037573 * b, 3);
        var m = Math.Pow(Lightness - 0.1055613458 * a - 0.0638541728 * b, 3);
        var s = Math.Pow(Lightness - 0.0894841775 * a - 1.2914855480 * b, 3);
        return (
            4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
            -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
            -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s);
    }

    private static bool InGamut((double Red, double Green, double Blue) rgb) =>
        new[] { rgb.Red, rgb.Green, rgb.Blue }.All(channel => channel >= -GamutTolerance && channel <= 1 + GamutTolerance);

    private static double ToLinear(int channel)
    {
        var value = channel / 255.0;
        return value <= 0.04045 ? value / 12.92 : Math.Pow((value + 0.055) / 1.055, 2.4);
    }

    private static int Encode(double linear)
    {
        var clamped = Math.Clamp(linear, 0, 1);
        var value = clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * Math.Pow(clamped, 1 / 2.4) - 0.055;
        return (int)Math.Round(value * 255);
    }
}
