'use strict';
// Mission data. Map legend:
//   #  wall               -  one-way platform (S + Space drops through)
//   H  ladder             V  vent: crouch to crawl, nobody can see you inside
//   D  security door      G  gate, opened by a gate lever; rats slip through
//   %  grate (rats only)  ~  puddle (deadly when the power surges)
//   P  player start       X  exit             T  target
//   g  guard              r  rat              w  caged worker
//   L  lamp  l small lamp Y/y lamp on the fuse-box circuit
//   C  hanging crate      u  crane release    v  gate lever
//   f  fuse box           k  locker           ?  sign
//   a  pellets            n  bottle           |  guard turn point (invisible)
(function (LO) {
  LO.LEVELS = [
    {
      id: 'night-shift',
      name: 'Night Shift',
      place: 'Grell & Sons Foundry',
      target: { name: 'Foreman Grell', route: [[50, 7, -1], [28, 7, 1]] },
      guards: [{}, {}, {}],
      ammo: 6, bottles: 2, par: 200,
      briefing: 'Foreman Grell runs the foundry night shift and locks his workers in cages between shifts. Tonight his shift ends early. Neutralize Grell, free who you can, and get back out the way you came in.',
      approaches: [
        { key: 'accident-crush', name: 'Workplace Accident', hint: 'Grell checks the shipment hanging from the crane. Ropes have been known to snap.' },
        { key: 'disguise', name: 'Borrowed Uniform', hint: 'The office door only opens for guards. A uniform would get you in.' },
        { key: 'puppeteer', name: 'Trusted Hands', hint: 'Grell trusts his own men. One of them could do the job for you.' },
        { key: 'takedown', name: 'Through the Roof', hint: 'A hatch in the roof drops straight into Grell\'s office.' },
      ],
      tips: [
        'The orange lever is the crane release. It drops the crate hanging below. Time it right and it was just a workplace accident.',
        'Press {possess} to possess a guard (aim near them with {aim}). Your body stays behind, defenseless. A possessed guard walks through security doors and can knock out anyone, even the Foreman.',
        'Move with {move}, jump with {jump}, crouch with {crouch}. Light exposes you. Keep the VISIBILITY meter low by sticking to the shadows.',
        'Climb ladders with {climb}. Crouch-walk ({crouch}) to move silently. Walking makes noise up close, and running ({run}) can be heard far away.',
        'Shoot out lights with {shoot}. Sneak up behind a guard and press {interact} for a takedown. A knocked-out guard\'s uniform gets you through security doors.',
      ],
      map: [
        '########################################################',
        '#                       L                   L          #',
        '#                                                      #',
        '#     ?   w     n   |         u     g   a     |        #',
        '###H################################################H###',
        '#  H  L      ###    L            L     #       L    H  #',
        '#  H         ###            C          #            H  #',
        '#  H         ###                       #            H  #',
        '#  H         ###                       D            H  #',
        '#  H ?    w  VVV |    g              | D          T H  #',
        '########H###########################H###################',
        '#       H      #      L             H   L              #',
        '#       H      #                    H                  #',
        '#       H      #                    H                  #',
        '#       H                           H                  #',
        '# X P ? H  ?     ?|       k   g     H         |     w  #',
        '########################################################',
        '########################################################',
      ],
    },
    {
      id: 'pumping-station',
      name: 'Low Water',
      place: 'Vask Pumping Station No. 4',
      target: { name: 'Overseer Vask', route: [[30, 8, 1], [40, 3, 0, true], [51, 7, -1]] },
      guards: [{}, {}, {}, { flashlight: true }],
      ammo: 5, bottles: 2, par: 240,
      fuseTime: 20,
      briefing: 'Overseer Vask keeps the pumps running on forced labor and drowned wages. He walks the pump hall every night, and he never watches where he steps. Make sure this is his last inspection.',
      approaches: [
        { key: 'accident-zap', name: 'Short Circuit', hint: 'Vask stands in standing water at the gauges. The fuse box upstairs feeds the whole hall.' },
        { key: 'accident-crush', name: 'Falling Pipe', hint: 'A sealed booth in the loft controls the crane. Only something small could get in.' },
        { key: 'puppeteer', name: 'Inside Job', hint: 'His guards walk right past him. One of them could stop walking.' },
        { key: 'takedown', name: 'From the Gallery', hint: 'The gallery grating lets you drop into the hall unseen.' },
      ],
      tips: [
        'Rats fit through grates and between gate bars. Possess one ({possess}) to reach places you can\'t.',
        'This fuse box powers the blue pump-hall lights. Overload it ({interact}, or a well-placed pellet) and the hall goes dark for a while... and anyone standing in water gets a nasty shock.',
        'The gate is locked from the inside. Find another way in, or find someone small enough to slip between the bars.',
        'Bottles ({throw}) shatter loudly where they land. Use them to pull guards away from their posts.',
      ],
      map: [
        '############################################################',
        '#                       #   #              L               #',
        '#                       #   #                              #',
        '#    ?  w     r         % u #                     a        #',
        '###H#####################################################H##',
        '#  H     L        ###     Y           Y                  H #',
        '#  H              ###                              C     H #',
        '#  H              ###                                    H #',
        '#  H              ###                                    H #',
        '#  H  ? f g   k   VVV|        g                          H #',
        '############H########----------------------              H #',
        '#           H #       Y           Y            L         H #',
        '#           H #                                          H #',
        '#           H #                                          H #',
        '#           H G                                          H #',
        '# X P ? r ? H G v|  g       ~~~~~   T n | |     g      w H #',
        '############################################################',
        '############################################################',
      ],
    },
    {
      id: 'glass-manor',
      name: 'The Gala',
      place: 'Vell Manor',
      target: { name: 'Baroness Vell', route: [[32, 8, -1], [20, 6, 1], [44, 6, -1, true]] },
      guards: [{ flashlight: true }, { speed: 50 }, {}, { flashlight: true }],
      ammo: 6, bottles: 3, par: 300,
      fuseTime: 18,
      briefing: 'Baroness Vell owns the foundry, the pumps and everyone in them. Tonight she toasts another record year under a crystal chandelier. Her servants are locked downstairs until the party ends. End the party.',
      approaches: [
        { key: 'accident-crush', name: 'Crystal Rain', hint: 'The Baroness gives her toast beneath the chandelier. Its winch is upstairs.' },
        { key: 'accident-zap', name: 'Spilled Champagne', hint: 'There\'s a puddle by the fountain where she mingles. The ballroom fuse box is in the servants\' quarters.' },
        { key: 'disguise', name: 'Staff Only', hint: 'The staff entrance to the ballroom only opens for guards.' },
        { key: 'puppeteer', name: 'Loyal Bodyguard', hint: 'Her bodyguard never leaves the ballroom.' },
      ],
      tips: [
        'The chandelier winch is up here. Pulling it would make quite a scene.',
        'Staff entrance. Only uniformed guards get through this door.',
        'Guards with flashlights light up whatever they point at. Stay out of the beam.',
      ],
      map: [
        '################################################################',
        '#                   L                       L                  #',
        '#                                                              #',
        '#                                                              #',
        '#   w       a               |   u       g         n       |  ? #',
        '########################H###################################H###',
        '#     l      #    Y     H Y           Y       Y    ###   L  H  #',
        '#            #          H       C                  ###      H  #',
        '#            #          H                          ###      H  #',
        '#            D          H                          ###      H  #',
        '#  k      ?  D |   ~~~  H       T   g            | VVV  w   H  #',
        '########H###############################H#######################',
        '#       H  #    L           l      ###  H   l         L        #',
        '#       H  #                       ###  H                      #',
        '#       H  #                       ###  H                      #',
        '#       H                          ###  H                      #',
        '# X P ? H    |    g      r    k |w VVV  H|     f  g         w  #',
        '################################################################',
        '################################################################',
      ],
    },
  ];
})(window.LO);
