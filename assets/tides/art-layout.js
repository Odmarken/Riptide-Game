/* Measured source rectangles for the unchanged Higgsfield PNG atlases.
 * Keep source aspect ratio. Details and provenance: art-manifest.json.
 * The nominal 3x2 grid is only a fallback; outlines can cross its boundaries.
 */
(function (root) {
  'use strict';
  const layout = {
    "meadowmouse": {
      "rect": [
        56,
        196,
        592,
        480
      ],
      "bounds": [
        68,
        208,
        567,
        456
      ],
      "atlas": "tides-1",
      "file": "assets/tides/tides-1.png",
      "cell": 0,
      "facing": 1
    },
    "bramblebunny": {
      "rect": [
        756,
        13,
        534,
        674
      ],
      "bounds": [
        768,
        25,
        502,
        650
      ],
      "atlas": "tides-1",
      "file": "assets/tides/tides-1.png",
      "cell": 1,
      "facing": 1
    },
    "pebbletoad": {
      "rect": [
        1410,
        255,
        540,
        450
      ],
      "bounds": [
        1423,
        268,
        514,
        423
      ],
      "atlas": "tides-1",
      "file": "assets/tides/tides-1.png",
      "cell": 2,
      "facing": 1
    },
    "thistlesparrow": {
      "rect": [
        34,
        725,
        630,
        618
      ],
      "bounds": [
        46,
        738,
        603,
        590
      ],
      "atlas": "tides-1",
      "file": "assets/tides/tides-1.png",
      "cell": 3,
      "facing": 1
    },
    "amberbeetle": {
      "rect": [
        748,
        846,
        610,
        462
      ],
      "bounds": [
        760,
        858,
        586,
        437
      ],
      "atlas": "tides-1",
      "file": "assets/tides/tides-1.png",
      "cell": 4,
      "facing": 1
    },
    "mossfox": {
      "rect": [
        20,
        81,
        648,
        588
      ],
      "bounds": [
        33,
        94,
        622,
        562
      ],
      "atlas": "tides-2",
      "file": "assets/tides/tides-2.png",
      "cell": 0,
      "facing": 1
    },
    "reedotter": {
      "rect": [
        685,
        133,
        692,
        542
      ],
      "bounds": [
        697,
        145,
        666,
        518
      ],
      "atlas": "tides-2",
      "file": "assets/tides/tides-2.png",
      "cell": 1,
      "facing": 1
    },
    "duskmoth": {
      "rect": [
        1415,
        61,
        626,
        608
      ],
      "bounds": [
        1428,
        74,
        600,
        582
      ],
      "atlas": "tides-2",
      "file": "assets/tides/tides-2.png",
      "cell": 2,
      "facing": 1
    },
    "shellsnap": {
      "rect": [
        43,
        801,
        632,
        492
      ],
      "bounds": [
        56,
        814,
        606,
        467
      ],
      "atlas": "tides-2",
      "file": "assets/tides/tides-2.png",
      "cell": 3,
      "facing": 1
    },
    "acornboar": {
      "rect": [
        712,
        715,
        629,
        582
      ],
      "bounds": [
        724,
        728,
        605,
        556
      ],
      "atlas": "tides-2",
      "file": "assets/tides/tides-2.png",
      "cell": 4,
      "facing": 1
    },
    "embercub": {
      "rect": [
        9,
        31,
        672,
        641
      ],
      "bounds": [
        21,
        44,
        647,
        622
      ],
      "atlas": "tides-3",
      "file": "assets/tides/tides-3.png",
      "cell": 0,
      "facing": 1
    },
    "moonowl": {
      "rect": [
        769,
        44,
        481,
        656
      ],
      "bounds": [
        782,
        57,
        456,
        630
      ],
      "atlas": "tides-3",
      "file": "assets/tides/tides-3.png",
      "cell": 1,
      "facing": 1
    },
    "crystalgecko": {
      "rect": [
        1352,
        180,
        668,
        520
      ],
      "bounds": [
        1365,
        193,
        642,
        495
      ],
      "atlas": "tides-3",
      "file": "assets/tides/tides-3.png",
      "cell": 2,
      "facing": 1
    },
    "stormlynx": {
      "rect": [
        37,
        677,
        649,
        653
      ],
      "bounds": [
        49,
        683,
        625,
        633
      ],
      "atlas": "tides-3",
      "file": "assets/tides/tides-3.png",
      "cell": 3,
      "facing": 1
    },
    "thornbadger": {
      "rect": [
        710,
        769,
        632,
        560
      ],
      "bounds": [
        723,
        782,
        606,
        534
      ],
      "atlas": "tides-3",
      "file": "assets/tides/tides-3.png",
      "cell": 4,
      "facing": 1
    },
    "cinderwolf": {
      "rect": [
        6,
        104,
        706,
        558
      ],
      "bounds": [
        18,
        117,
        681,
        539
      ],
      "atlas": "tides-4",
      "file": "assets/tides/tides-4.png",
      "cell": 0,
      "facing": 1
    },
    "frostibex": {
      "rect": [
        749,
        12,
        592,
        658
      ],
      "bounds": [
        762,
        25,
        567,
        632
      ],
      "atlas": "tides-4",
      "file": "assets/tides/tides-4.png",
      "cell": 1,
      "facing": 1
    },
    "sunmane": {
      "rect": [
        1349,
        70,
        681,
        602
      ],
      "bounds": [
        1362,
        83,
        656,
        576
      ],
      "atlas": "tides-4",
      "file": "assets/tides/tides-4.png",
      "cell": 2,
      "facing": 1
    },
    "runestag": {
      "rect": [
        66,
        662,
        633,
        675
      ],
      "bounds": [
        79,
        667,
        607,
        658
      ],
      "atlas": "tides-4",
      "file": "assets/tides/tides-4.png",
      "cell": 3,
      "facing": 1
    },
    "coraldrake": {
      "rect": [
        704,
        692,
        698,
        648
      ],
      "bounds": [
        717,
        705,
        672,
        622
      ],
      "atlas": "tides-4",
      "file": "assets/tides/tides-4.png",
      "cell": 4,
      "facing": 1
    },
    "dawnphoenix": {
      "rect": [
        20,
        8,
        632,
        672
      ],
      "bounds": [
        32,
        21,
        607,
        652
      ],
      "atlas": "tides-5",
      "file": "assets/tides/tides-5.png",
      "cell": 0,
      "facing": 1
    },
    "obsidianbear": {
      "rect": [
        672,
        72,
        707,
        604
      ],
      "bounds": [
        685,
        85,
        694,
        579
      ],
      "atlas": "tides-5",
      "file": "assets/tides/tides-5.png",
      "cell": 1,
      "facing": 1
    },
    "aurorakirin": {
      "rect": [
        1379,
        5,
        628,
        675
      ],
      "bounds": [
        1379,
        18,
        615,
        649
      ],
      "atlas": "tides-5",
      "file": "assets/tides/tides-5.png",
      "cell": 2,
      "facing": 1
    },
    "spectralpanther": {
      "rect": [
        9,
        752,
        679,
        579
      ],
      "bounds": [
        22,
        765,
        644,
        552
      ],
      "atlas": "tides-5",
      "file": "assets/tides/tides-5.png",
      "cell": 3,
      "facing": 1
    },
    "spectralwyrm": {
      "rect": [
        744,
        680,
        601,
        662
      ],
      "bounds": [
        756,
        687,
        576,
        642
      ],
      "atlas": "tides-5",
      "file": "assets/tides/tides-5.png",
      "cell": 4,
      "facing": 1
    },
    "lasso": {
      "rect": [
        132,
        112,
        856,
        809
      ],
      "bounds": [
        148,
        128,
        824,
        777
      ],
      "file": "assets/tides/lasso.png"
    }
  };
  root.TideArtLayout = layout;
  if (typeof module !== 'undefined' && module.exports) module.exports = layout;
})(typeof globalThis !== 'undefined' ? globalThis : window);
