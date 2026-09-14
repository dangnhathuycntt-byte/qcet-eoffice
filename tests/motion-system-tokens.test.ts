import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  motionDuration,
  motionEase,
  motionSpring,
  motionTransition,
} from "../src/lib/motion/tokens";
import {
  fadeVariants,
  popoverVariants,
  dialogVariants,
  sideSheetVariants,
  bottomSheetVariants,
  toastVariants,
  listItemVariants,
  staggerContainerVariants,
} from "../src/lib/motion/variants";

describe("Motion Tokens & System Specifications", () => {
  it("defines asymmetric enterprise duration tokens", () => {
    assert.equal(motionDuration.instant, 0.08);
    assert.equal(motionDuration.micro, 0.1);
    assert.equal(motionDuration.dropdownEnter, 0.18);
    assert.equal(motionDuration.dropdownExit, 0.14);
    assert.equal(motionDuration.modalEnter, 0.22);
    assert.equal(motionDuration.modalExit, 0.16);
    assert.equal(motionDuration.panelEnter, 0.26);
    assert.equal(motionDuration.panelExit, 0.2);
    // Backward compatibility tokens
    assert.equal(motionDuration.fast, 0.14);
    assert.equal(motionDuration.normal, 0.18);
    assert.equal(motionDuration.panel, 0.26);
  });

  it("defines deceleration and acceleration easing curves", () => {
    assert.deepEqual(motionEase.enter, [0.16, 1, 0.3, 1]);
    assert.deepEqual(motionEase.exit, [0.4, 0, 1, 1]);
    assert.deepEqual(motionEase.standard, [0.2, 0, 0, 1]);
  });

  it("defines physics spring tokens", () => {
    assert.equal(motionSpring.snappy.type, "spring");
    assert.equal(motionSpring.snappy.stiffness, 450);
    assert.equal(motionSpring.snappy.damping, 35);
    assert.equal(motionSpring.snappy.mass, 0.8);

    assert.equal(motionSpring.gentle.type, "spring");
    assert.equal(motionSpring.gentle.stiffness, 280);
    assert.equal(motionSpring.gentle.damping, 28);
    assert.equal(motionSpring.gentle.mass, 1);
  });

  it("exports calibrated motionTransition presets", () => {
    assert.equal(motionTransition.micro.duration, 0.1);
    assert.equal(motionTransition.enter.duration, 0.22);
    assert.equal(motionTransition.exit.duration, 0.16);
    assert.equal(motionTransition.panel.duration, 0.26);
    assert.equal(motionTransition.panelExit.duration, 0.2);
    assert.equal(motionTransition.dropdown.duration, 0.18);
    assert.equal(motionTransition.dropdownExit.duration, 0.14);
    assert.deepEqual(motionTransition.snappySpring, motionSpring.snappy);
    assert.deepEqual(motionTransition.gentleSpring, motionSpring.gentle);
  });

  it("exports asymmetric variants for modals, popovers, sheets and lists", () => {
    // fadeVariants
    assert.deepEqual(fadeVariants.initial, { opacity: 0 });
    assert.ok(fadeVariants.animate);
    assert.ok(fadeVariants.exit);

    // popoverVariants
    assert.ok(popoverVariants.initial);
    assert.ok(popoverVariants.animate);
    assert.ok(popoverVariants.exit);

    // dialogVariants
    assert.ok(dialogVariants.initial);
    assert.ok(dialogVariants.animate);
    assert.ok(dialogVariants.exit);

    // sideSheetVariants
    assert.deepEqual(sideSheetVariants.initial, { x: "100%" });
    assert.ok(sideSheetVariants.animate);
    assert.ok(sideSheetVariants.exit);

    // bottomSheetVariants
    assert.deepEqual(bottomSheetVariants.initial, { y: "100%" });
    assert.ok(bottomSheetVariants.animate);
    assert.ok(bottomSheetVariants.exit);

    // listItemVariants
    assert.ok(listItemVariants.initial);
    assert.ok(listItemVariants.animate);
    assert.ok(listItemVariants.exit);

    // toastVariants
    assert.ok(toastVariants.initial);
    assert.ok(toastVariants.animate);
    assert.ok(toastVariants.exit);

    // staggerContainerVariants
    assert.ok(staggerContainerVariants.animate);
    assert.ok(staggerContainerVariants.exit);
  });
});
