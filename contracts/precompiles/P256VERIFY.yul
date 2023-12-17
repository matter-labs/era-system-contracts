object "P256VERIFY" {
    code { }
    object "P256VERIFY_deployed" {
        code {
            // Constants

            // CURVE CONSTANTS

            /// @notice Constant function for curve reduced elliptic group order.
            /// @dev P is a prime number which defines the field which is a domain of the curve parameters.
            /// @dev See https://neuromancer.sk/std/secg/secp256r1 for further details.
            /// @return p The curve reduced elliptic group order.
            function P() -> p {
                p := 0xffffffff00000001000000000000000000000000ffffffffffffffffffffffff
            }

            /// @notice Constant function for curve subgroup order.
            /// @dev N is the order of generator G.
            /// @dev See https://neuromancer.sk/std/secg/secp256r1 for further details.
            /// @return n The curve subgroup order.
            function N() -> n {
                n := 0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551
            }

            // MONTGOMERY CONSTANTS

            /// @notice Constant function for value one in Montgomery form for modulus P().
            /// @dev This value was precomputed using Python.
            /// @return m_one The value one in Montgomery form.
            function MONTGOMERY_ONE_P() -> m_one {
                m_one := 26959946660873538059280334323183841250350249843923952699046031785985
            }

            /// @notice Constant function for value one in Montgomery form for modulus N().
            /// @dev This value was precomputed using Python.
            /// @return m_one The value one in Montgomery form for modulus N().
            function MONTGOMERY_ONE_N() -> m_one {
                m_one := 26959946660873538059280334323273029441504803697035324946844617595567
            }

            /// @notice Constant function curve parameter `a` in Montgomery form for modulus P().
            /// @dev See https://neuromancer.sk/std/secg/secp256r1 for further details.
            /// @dev This value was precomputed using Python.
            /// @return m_a The curve parameter `a` in Montgomery form for modulus P().
            function MONTGOMERY_A_P() -> m_a {
                m_a := 115792089129476408780076832771566570560534619664239564663761773211729002495996
            }

            /// @notice Constant function curve parameter `b` in Montgomery form for modulus P().
            /// @dev See https://neuromancer.sk/std/secg/secp256r1 for further details.
            /// @dev This value was precomputed using Python.
            /// @return m_b The curve parameter `b` in Montgomery form for modulus P().
            function MONTGOMERY_B_P() -> m_b {
                m_b := 99593677540221402957765480916910020772520766868399186769503856397241456836063
            }

            /// @notice Constant function for the generator point in Montgomery form for modulus P() in projective form.
            /// @dev This value was precomputed using Python.
            /// @return m_gx The x projective coordinate of the generator point in Montgomery form for modulus P().
            /// @return m_gy The y projective coordinate of the generator point in Montgomery form for modulus P().
            /// @return m_gz The z projective coordinate of the generator point in Montgomery form for modulus P().
            function MONTGOMERY_PROJECTIVE_G_P() -> m_gx, m_gy, m_gz {
                m_gx := 0x18905F76A53755C679FB732B7762251075BA95FC5FEDB60179E730D418A9143C
                m_gy := 0x8571FF1825885D85D2E88688DD21F3258B4AB8E4BA19E45CDDF25357CE95560A
                m_gz := MONTGOMERY_ONE_P()
            }

            /// @notice Constant function for the pre-computation of R^2 % P for the Montgomery REDC algorithm.
            /// @dev R^2 is the Montgomery residue of the value 2^512.
            /// @dev See https://en.wikipedia.org/wiki/Montgomery_modular_multiplication#The_REDC_algorithm for further detals.
            /// @dev This value was precomputed using Python.
            /// @return ret The value R^2 modulus the curve group order.
            function R2_MOD_P() -> ret {
                ret := 134799733323198995502561713907086292154532538166959272814710328655875
            }

            /// @notice Constant function for the pre-computation of R^2 % N for the Montgomery REDC algorithm.
            /// @dev R^2 is the Montgomery residue of the value 2^512.
            /// @dev See https://en.wikipedia.org/wiki/Montgomery_modular_multiplication#The_REDC_algorithm for further detals.
            /// @dev This value was precomputed using Python.
            /// @return ret The value R^2 modulus the curve group order.
            function R2_MOD_N() -> ret {
                ret := 46533765739406314298121036767150998762426774378559716911348521029833835802274
            }

            /// @notice Constant function for the pre-computation of P' for the Montgomery REDC algorithm.
            /// @dev P' is a value such that PP' = -1 mod R, with N being the curve group order.
            /// @dev See https://en.wikipedia.org/wiki/Montgomery_modular_multiplication#The_REDC_algorithm for further detals.
            /// @dev This value was precomputed using Python.
            /// @return ret The value P'.
            function P_PRIME() -> ret {
                ret := 115792089210356248768974548684794254293921932838497980611635986753331132366849
            }

            /// @notice Constant function for the pre-computation of N' for the Montgomery REDC algorithm.
            /// @dev N' is a value such that NN' = -1 mod R, with N being the curve group order.
            /// @dev See https://en.wikipedia.org/wiki/Montgomery_modular_multiplication#The_REDC_algorithm for further detals.
            /// @dev This value was precomputed using Python.
            /// @return ret The value N'.
            function N_PRIME() -> ret {
                ret := 43790243024438006127650828685417305984841428635278707415088219106730833919055
            }

            // Function Helpers

            /// @dev Executes the `precompileCall` opcode.
			function precompileCall(precompileParams, gasToBurn) -> ret {
				// Compiler simulation for calling `precompileCall` opcode
				ret := verbatim_2i_1o("precompile", precompileParams, gasToBurn)
			}

            /// @notice Burns remaining gas until revert.
            /// @dev This function is used to burn gas in the case of a failed precompile call.
            function burnGas() {
				// Precompiles that do not have a circuit counterpart
				// will burn the provided gas by calling this function.
				precompileCall(0, gas())
		  	}

            // MONTGOMERY

            /// @notice Computes the inverse in Montgomery Form of a number in Montgomery Form.
            /// @dev Reference: https://github.com/lambdaclass/lambdaworks/blob/main/math/src/field/fields/montgomery_backed_prime_fields.rs#L169
            /// @dev Let `base` be a number in Montgomery Form, then base = a*R mod modulus being `a` the base number (not in Montgomery Form)
            /// @dev Let `inv` be the inverse of a number `a` in Montgomery Form, then inv = a^(-1)*R mod modulus
            /// @dev The original binary extended euclidean algorithms takes a number a and returns a^(-1) mod N
            /// @dev In our case N is modulus, and we'd like the input and output to be in Montgomery Form (a*R mod modulus 
            /// @dev and a^(-1)*R mod modulus respectively).
            /// @dev If we just pass the input as a number in Montgomery Form the result would be a^(-1)*R^(-1) mod modulus,
            /// @dev but we want it to be a^(-1)*R mod modulus.
            /// @dev For that, we take advantage of the algorithm's linearity and multiply the result by R^2 mod modulus
            /// @dev to get R^2*a^(-1)*R^(-1) mod modulus = a^(-1)*R mod modulus as the desired result in Montgomery Form.
            /// @dev `inv` takes the value of `b` or `c` being the result sometimes `b` and sometimes `c`. In paper
            /// @dev multiplying `b` or `c` by R^2 mod modulus results on starting their values as b = R^2 mod modulus and c = 0.
            /// @param base A number `a` in Montgomery Form, then base = a*R mod modulus.
            /// @param modulus The modulus.
            /// @param r2 The pre-computed value of R^2 mod n.
            /// @return inv The inverse of a number `a` in Montgomery Form, then inv = a^(-1)*R mod modulus.
            function binaryExtendedEuclideanAlgorithm(base, modulus, r2) -> inv {
                // Precomputation of 1 << 255
                let mask := 57896044618658097711785492504343953926634992332820282019728792003956564819968
                // modulus >> 255 == 0 -> modulus & 1 << 255 == 0
                let modulusHasSpareBits := iszero(and(modulus, mask))

                let u := base
                let v := modulus
                // Avoids unnecessary reduction step.
                let b := r2
                let c := 0x0

                for {} and(iszero(eq(u, 0x1)), iszero(eq(v, 0x1))) {} {
                    for {} iszero(and(u, 0x1)) {} {
                        u := shr(1, u)
                        switch and(b, 0x1)
                        case 0 {
                            b := shr(1, b)
                        }
                        case 1 {
                            let newB, carry := overflowingAdd(b, modulus)
                            b := shr(1, newB)

                            if and(iszero(modulusHasSpareBits), carry) {
                                b := or(b, mask)
                            }
                        }
                    }

                    for {} iszero(and(v, 0x1)) {} {
                        v := shr(1, v)
                        switch and(c, 0x1)
                        case 0 {
                            c := shr(1, c)
                        }
                        case 1 {
                            let newC, carry := overflowingAdd(c, modulus)
                            c := shr(1, newC)

                            if and(iszero(modulusHasSpareBits), carry) {
                                c := or(c, mask)
                            }
                        }
                    }

                    switch gt(v, u)
                    case 0 {
                        u := sub(u, v)
                        if lt(b, c) {
                            b := add(b, modulus)
                        }
                        b := sub(b, c)
                    }
                    case 1 {
                        v := sub(v, u)
                        if lt(c, b) {
                            c := add(c, modulus)
                        }
                        c := sub(c, b)
                    }
                }

                switch eq(u, 0x1)
                case 0 {
                    inv := c
                }
                case 1 {
                    inv := b
                }
            }

            /// @notice Computes an addition and checks for overflow.
            /// @param augend The value to add to.
            /// @param addend The value to add.
            /// @return sum The sum of the two values.
            /// @return overflowed True if the addition overflowed, false otherwise.
            function overflowingAdd(augend, addend) -> sum, overflowed {
                sum := add(augend, addend)
                overflowed := lt(sum, augend)
            }

            /// @notice Retrieves the highest half of the multiplication result.
            /// @param multiplicand The value to multiply.
            /// @param multiplier The multiplier.
            /// @return ret The highest half of the multiplication result.
            function getHighestHalfOfMultiplication(multiplicand, multiplier) -> ret {
                ret := verbatim_2i_1o("mul_high", multiplicand, multiplier)
            }

            /// @notice Implementation of the Montgomery reduction algorithm (a.k.a. REDC).
            /// @dev See https://en.wikipedia.org/wiki/Montgomery_modular_multiplication//The_REDC_algorithm
            /// @param lowestHalfOfT The lowest half of the value T.
            /// @param higherHalfOfT The higher half of the value T.
            /// @param n The modulus.
            /// @param nPrime The pre-computed value of N' for the Montgomery REDC algorithm.
            /// @return S The result of the Montgomery reduction.
            function REDC(TLo, THi, n, nPrime) -> S {
                let m := mul(TLo, nPrime)
                let tHi, tHiOverflowed1 := overflowingAdd(THi, getHighestHalfOfMultiplication(m, n))
                let aLo, aLoOverflowed := overflowingAdd(TLo, mul(m, n))
                let tHiOverflowed2 := 0
                if aLoOverflowed {
                    tHi, tHiOverflowed2 := overflowingAdd(tHi, 1)
                }
                S := tHi
                if or(or(tHiOverflowed1, tHiOverflowed2), iszero(lt(tHi, n))) {
                    S := sub(tHi, n)
                }
            }

            /// @notice Encodes a field element into the Montgomery form using the Montgomery reduction algorithm (REDC).
            /// @dev See https://en.wikipedia.org/wiki/Montgomery_modular_multiplication//The_REDC_algorithmfor further details on transforming a field element into the Montgomery form.
            /// @param a The field element to encode.
            /// @param n The modulus.
            /// @param nPrime The pre-computed value of N' for the Montgomery REDC algorithm.
            /// @param r2 The pre-computed value of R^2 mod n.
            /// @return ret The field element in Montgomery form.
            function intoMontgomeryForm(a, n, nPrime, r2) -> ret {
                let hi := getHighestHalfOfMultiplication(a, r2)
                let lo := mul(a, r2)
                ret := REDC(lo, hi, n, nPrime)
            }

            /// @notice Decodes a field element out of the Montgomery form using the Montgomery reduction algorithm (REDC).
            /// @dev See https://en.wikipedia.org/wiki/Montgomery_modular_multiplication//The_REDC_algorithm for further details on transforming a field element out of the Montgomery form.
            /// @param m The field element in Montgomery form to decode.
            /// @param n The modulus.
            /// @param nPrime The pre-computed value of N' for the Montgomery REDC algorithm.
            /// @return ret The decoded field element.
            function outOfMontgomeryForm(m, n, nPrime) -> ret {
                let hi := 0
                let lo := m
                ret := REDC(lo, hi, n, nPrime)
            }

            /// @notice Computes the Montgomery addition.
            /// @param augend The augend in Montgomery form.
            /// @param addend The addend in Montgomery form.
            /// @param n The modulus.
            /// @return ret The result of the Montgomery addition.
            function montgomeryAdd(augend, addend, n) -> ret {
                ret := addmod(augend, addend, n)
            }

            /// @notice Computes the Montgomery subtraction.
            /// @param minuend The minuend in Montgomery form.
            /// @param subtrahend The subtrahend in Montgomery form.
            /// @param n The modulus.
            /// @return ret The result of the Montgomery subtraction.
            function montgomerySub(minuend, subtrahend, n) -> ret {
                ret := montgomeryAdd(minuend, sub(n, subtrahend), n)
            }

            /// @notice Computes the Montgomery multiplication using the Montgomery reduction algorithm (REDC).
            /// @dev See https://en.wikipedia.org/wiki/Montgomery_modular_multiplication//The_REDC_algorithm for further details on the Montgomery multiplication.
            /// @param multiplicand The multiplicand in Montgomery form.
            /// @param multiplier The multiplier in Montgomery form.
            /// @param n The modulus.
            /// @param nPrime The pre-computed value of N' for the Montgomery REDC algorithm.
            /// @return ret The result of the Montgomery multiplication.
            function montgomeryMul(multiplicand, multiplier, n, nPrime) -> ret {
                let hi := getHighestHalfOfMultiplication(multiplicand, multiplier)
                let lo := mul(multiplicand, multiplier)
                ret := REDC(lo, hi, n, nPrime)
            }

            /// @notice Computes the Montgomery modular inverse skipping the Montgomery reduction step.
            /// @dev The Montgomery reduction step is skept because a modification in the binary extended Euclidean algorithm is used to compute the modular inverse.
            /// @dev See the function `binaryExtendedEuclideanAlgorithm` for further details.
            /// @param a The field element in Montgomery form to compute the modular inverse of.
            /// @param n The modulus.
            /// @param r2 The pre-computed value of R^2 mod n.
            /// @return invmod The result of the Montgomery modular inverse (in Montgomery form).
            function montgomeryModularInverse(a, n, r2) -> invmod {
                invmod := binaryExtendedEuclideanAlgorithm(a, n, r2)
            }

            // CURVE ARITHMETICS

            /// @notice Checks if a field element is on the curve group order.
            /// @dev A field element is on the curve group order if it is on the range [0, curveGroupOrder).
            /// @param felt The field element to check.
            /// @return ret True if the field element is in the range, false otherwise.
            function fieldElementIsOnFieldOrder(felt) -> ret {
                ret := lt(felt, P())
            }

            /// @notice Checks if a field element is on the subgroup order.
            /// @dev A field element is on the subgroup order if it is on the range [0, subgroupOrder).
            /// @param felt The field element to check.
            /// @return ret True if the field element is in the range, false otherwise.
            function fieldElementIsOnSubgroupOrder(felt) -> ret {
                ret := lt(felt, N())
            }

            /// @notice Checks if affine coordinates are on the curve group order.
            /// @dev Affine coordinates are on the curve group order if both coordinates are on the range [0, curveGroupOrder).
            /// @param xp The x coordinate of the point P to check.
            /// @param yp The y coordinate of the point P to check.
            /// @return ret True if the coordinates are in the range, false otherwise.
            function affinePointCoordinatesAreOnFieldOrder(xp, yp) -> ret {
                ret := and(fieldElementIsOnFieldOrder(xp), fieldElementIsOnFieldOrder(yp))
            }

            /// @notice Checks if a point in affine coordinates is the point at infinity.
            /// @dev The point at infinity is defined as the point (0, 0).
            /// @dev See https://eips.ethereum.org/EIPS/eip-196 for further details.
            /// @param xp The x coordinate of the point P in Montgomery form for modulus P().
            /// @param yp The y coordinate of the point P in Montgomery form for modulus P().
            /// @return ret True if the point is the point at infinity, false otherwise.
            function affinePointIsInfinity(xp, yp) -> ret {
                ret := iszero(or(xp, yp))
            }

            // @notice Checks if a point in affine coordinates in Montgomery form is on the curve.
            // @dev The curve in question is the secp256r1 curve.
            // @dev The Short Weierstrass equation of the curve is y^2 = x^3 + ax + b.
            // @param xp The x coordinate of the point P in Montgomery form for modulus P().
            // @param yp The y coordinate of the point P in Montgomery form for modulus P().
            // @return ret True if the point is on the curve, false otherwise.
            function affinePointIsOnCurve(xp, yp) -> ret {
                let left := montgomeryMul(yp, yp, P(), P_PRIME())
                let right := montgomeryAdd(montgomeryMul(xp, montgomeryMul(xp, xp, P(), P_PRIME()), P(), P_PRIME()), montgomeryAdd(montgomeryMul(MONTGOMERY_A_P(), xp, P(), P_PRIME()), MONTGOMERY_B_P(), P()), P())
                ret := eq(left, right)
            }

            /// @notice Converts a point in affine coordinates to projective coordinates in Montgomery form for modulus P().
            /// @dev The point at infinity is defined as the point (0, 0, 0).
            /// @dev For performance reasons, the point is assumed to be previously checked to be on the 
            /// @dev curve and not the point at infinity.
            /// @param xp The x coordinate of the point P in affine coordinates in Montgomery form.
            /// @param yp The y coordinate of the point P in affine coordinates in Montgomery form.
            /// @return xr The x coordinate of the point P in projective coordinates in Montgomery form.
            /// @return yr The y coordinate of the point P in projective coordinates in Montgomery form.
            /// @return zr The z coordinate of the point P in projective coordinates in Montgomery form.
            function projectiveFromAffine(xp, yp) -> xr, yr, zr {
                xr := xp
                yr := yp
                zr := MONTGOMERY_ONE_P()
            }

            /// @notice Checks if a point in projective coordinates is the point at infinity.
            /// @dev The point at infinity is defined as the point (0, 0, 0).
            /// @param xp The x coordinate of the point P in projective coordinates in Montgomery form.
            /// @param yp The y coordinate of the point P in projective coordinates in Montgomery form.
            /// @param zp The z coordinate of the point P in projective coordinates in Montgomery form.
            /// @return ret True if the point is the point at infinity, false otherwise.
            function projectivePointIsInfinity(xp, yp, zp) -> ret {
                ret := iszero(zp)
            }

            /// @notice Doubles a point in projective coordinates in Montgomery form for modulus P().
            /// @dev See https://www.nayuki.io/page/elliptic-curve-point-addition-in-projective-coordinates for further details.
            /// @dev For performance reasons, the point is assumed to be previously checked to be on the
            /// @dev curve and not the point at infinity.
            /// @param xp The x coordinate of the point P in projective coordinates in Montgomery form.
            /// @param yp The y coordinate of the point P in projective coordinates in Montgomery form.
            /// @param zp The z coordinate of the point P in projective coordinates in Montgomery form.
            /// @return xr The x coordinate of the point 2P in projective coordinates in Montgomery form.
            /// @return yr The y coordinate of the point 2P in projective coordinates in Montgomery form.
            /// @return zr The z coordinate of the point 2P in projective coordinates in Montgomery form.
            function projectiveDouble(xp, yp, zp) -> xr, yr, zr {
                let x_squared := montgomeryMul(xp, xp, P(), P_PRIME())
                let z_squared := montgomeryMul(zp, zp, P(), P_PRIME())
                let az_squared := montgomeryMul(MONTGOMERY_A_P(), z_squared, P(), P_PRIME())
                let t := montgomeryAdd(montgomeryAdd(x_squared, montgomeryAdd(x_squared, x_squared, P()), P()), az_squared, P())
                let yz := montgomeryMul(yp, zp, P(), P_PRIME())
                let u := montgomeryAdd(yz, yz, P())
                let uxy := montgomeryMul(u, montgomeryMul(xp, yp, P(), P_PRIME()), P(), P_PRIME())
                let v := montgomeryAdd(uxy, uxy, P())
                let w := montgomerySub(montgomeryMul(t, t, P(), P_PRIME()), montgomeryAdd(v, v, P()), P())

                xr := montgomeryMul(u, w, P(), P_PRIME())
                let uy := montgomeryMul(u, yp, P(), P_PRIME())
                let uy_squared := montgomeryMul(uy, uy, P(), P_PRIME())
                yr := montgomerySub(montgomeryMul(t, montgomerySub(v, w, P()), P(), P_PRIME()), montgomeryAdd(uy_squared, uy_squared, P()), P())
                zr := montgomeryMul(u, montgomeryMul(u, u, P(), P_PRIME()), P(), P_PRIME())
            }

            /// @notice Adds two points in projective coordinates in Montgomery form for modulus P().
            /// @dev See https://www.nayuki.io/page/elliptic-curve-point-addition-in-projective-coordinates for further details.
            /// @dev For performance reasons, the points are assumed to be previously checked to be on the
            /// @dev curve and not the point at infinity.
            /// @param xp The x coordinate of the point P in projective coordinates in Montgomery form.
            /// @param yp The y coordinate of the point P in projective coordinates in Montgomery form.
            /// @param zp The z coordinate of the point P in projective coordinates in Montgomery form.
            /// @param xq The x coordinate of the point Q in projective coordinates in Montgomery form.
            /// @param yq The y coordinate of the point Q in projective coordinates in Montgomery form.
            /// @param zq The z coordinate of the point Q in projective coordinates in Montgomery form.
            /// @return xr The x coordinate of the point P + Q in projective coordinates in Montgomery form.
            /// @return yr The y coordinate of the point P + Q in projective coordinates in Montgomery form.
            /// @return zr The z coordinate of the point P + Q in projective coordinates in Montgomery form.
            function projectiveAdd(xp, yp, zp, xq, yq, zq) -> xr, yr, zr {
                let qIsInfinity := projectivePointIsInfinity(xq, yq, zq)
                let pIsInfinity := projectivePointIsInfinity(xp, yp, zp)
                if pIsInfinity {
                    // Infinity + Q = Q
                    xr := xq
                    yr := yq
                    zr := zq
                    leave
                }
                if qIsInfinity {
                    // P + Infinity = P
                    xr := xp
                    yr := yp
                    zr := zp
                    leave
                }

                let t0 := montgomeryMul(yp, zq, P(), P_PRIME())
                let t1 := montgomeryMul(yq, zp, P(), P_PRIME())
                let t := montgomerySub(t0, t1, P())
                let u0 := montgomeryMul(xp, zq, P(), P_PRIME())
                let u1 := montgomeryMul(xq, zp, P(), P_PRIME())
                let u := montgomerySub(u0, u1, P())

                // t = (yp*zq - yq*zp); u = (xp*zq - xq*zp)
                if iszero(or(t, u)) {
                    // P + P = 2P
                    xr, yr, zr := projectiveDouble(xp, yp, zp)
                    leave
                }
            
                // P1 + P2 = P3
                let u2 := montgomeryMul(u, u, P(), P_PRIME())
                let u3 := montgomeryMul(u2, u, P(), P_PRIME())
                let v := montgomeryMul(zp, zq, P(), P_PRIME())
                let w := montgomerySub(montgomeryMul(montgomeryMul(t, t, P(), P_PRIME()), v, P(), P_PRIME()), montgomeryMul(u2, montgomeryAdd(u0, u1, P()), P(), P_PRIME()), P())

                xr := montgomeryMul(u, w, P(), P_PRIME())
                yr := montgomerySub(montgomeryMul(t, montgomerySub(montgomeryMul(u0, u2, P(), P_PRIME()), w, P()), P(), P_PRIME()), montgomeryMul(t0, u3, P(), P_PRIME()), P())
                zr := montgomeryMul(u3, v, P(), P_PRIME())
            }

            /// @notice Computes the linear combination of curve points: t0*Q + t1*G = R
            /// @param xq The x coordinate of the point Q in projective coordinates in Montgomery form.
            /// @param yq The y coordinate of the point Q in projective coordinates in Montgomery form.
            /// @param zq The z coordinate of the point Q in projective coordinates in Montgomery form.
            /// @param t0 The scalar to multiply the generator G by.
            /// @param t1 The scalar to multiply the point Q by.
            /// @return xr The x coordinate of the resulting point R in projective coordinates in Montgomery form.
            /// @return yr The y coordinate of the resulting point R in projective coordinates in Montgomery form.
            /// @return zr The z coordinate of the resulting point R in projective coordinates in Montgomery form.
            function shamirLinearCombination(xq, yq, zq, t0, t1) -> xr, yr, zr {
                let xg, yg, zg := MONTGOMERY_PROJECTIVE_G_P()
                let xh, yh, zh := projectiveAdd(xg, yg, zg, xq, yq, zq)
                let index, ret := findMostSignificantBitIndex(t0, t1)
                switch ret
                case 1 {
                    xr := xq
                    yr := yq
                    zr := zq
                }
                case 2 {
                    xr := xg
                    yr := yg
                    zr := zg
                }
                case 3 {
                    xr := xh
                    yr := yh
                    zr := zh
                }
                let ret
                for {} gt(index, 0) {} {
                    index := sub(index, 1)
                    xr, yr, zr := projectiveDouble(xr, yr, zr)
                    ret := compareBits(index, t0, t1)
                    switch ret
                    case 1 {
                        xr, yr, zr := projectiveAdd(xr, yr, zr, xq, yq, zq)
                    }
                    case 2 {
                        xr, yr, zr := projectiveAdd(xr, yr, zr, xg, yg, zg)
                    }
                    case 3 {
                        xr, yr, zr := projectiveAdd(xr, yr, zr, xh, yh, zh)
                    }
                }
            }

            /// @notice Computes the largest index of the most significant bit among two scalars,
            /// @notice and indicates which scalar it belongs to.
            /// @param t0 The first scalar.
            /// @param t1 The second scalar.
            /// @return index The position of the most significant bit among t0 and t1.
            /// @return ret Indicates which scalar the most significant bit belongs to.
            /// @return return 1 if it belongs to t1, returns 2 if it belongs to t0,
            /// @return and returns 3 if both have the most significant bit in the same position.
            function findMostSignificantBitIndex(t0, t1) -> index, ret {
                index := 255
                ret := 0
                for {} eq(ret, 0) { index := sub(index, 1) } {
                    ret := compareBits(index, t0, t1)
                }
                index := add(index, 1)
            }

            /// @notice Compares the bits between two scalars at a specific position.
            /// @param index The position to compare.
            /// @param t0 The first scalar.
            /// @param t1 The second scalar.
            /// @return ret A value that indicates the value of the bits. 
            /// @return ret is 0 if both are 0.
            /// @return ret is 1 if the bit of t0 is 0 and the bit of t1 is 1.
            /// @return ret is 2 if the bit of t0 is 1 and the bit of t1 is 0.
            /// @return ret is 3 if both bits are 1.
            function compareBits(index, t0, t1) -> ret {
                ret := add(mul(and(shr(index, t0), 1), 2), and(shr(index, t1), 1))
            }

            // Fallback
            let hash := calldataload(0)
            let r := calldataload(32)
            let s := calldataload(64)
            let x := calldataload(96)
            let y := calldataload(128)

            if or(or(iszero(r), iszero(fieldElementIsOnSubgroupOrder(r))), or(iszero(s), iszero(fieldElementIsOnSubgroupOrder(s)))) {
                burnGas()
            }

            if or(affinePointIsInfinity(x, y), iszero(affinePointCoordinatesAreOnFieldOrder(x, y))) {
                burnGas()
            }

            x := intoMontgomeryForm(x, P(), P_PRIME(), R2_MOD_P())
            y := intoMontgomeryForm(y, P(), P_PRIME(), R2_MOD_P())

            if iszero(affinePointIsOnCurve(x, y)) {
                burnGas()
            }

            let z
            x, y, z := projectiveFromAffine(x, y)

            // TODO: Check if r, s, s1, t0 and t1 operations are optimal in Montgomery form or not

            hash := intoMontgomeryForm(hash, N(), N_PRIME(), R2_MOD_N())
            let rTmp := r
            r := intoMontgomeryForm(r, N(), N_PRIME(), R2_MOD_N())
            s := intoMontgomeryForm(s, N(), N_PRIME(), R2_MOD_N())

            let s1 := montgomeryModularInverse(s, N(), R2_MOD_N())

            let t0 := outOfMontgomeryForm(montgomeryMul(hash, s1, N(), N_PRIME()), N(), N_PRIME())
            let t1 := outOfMontgomeryForm(montgomeryMul(r, s1, N(), N_PRIME()), N(), N_PRIME())

            let xr, yr, zr := shamirLinearCombination(x, y, z, t0, t1)
            if iszero(zr) {
                mstore(0, 0)
                return(0, 32)
            }

            // As we only need xr in affine form, we can skip transforming the `y` coordinate.
            let z_inv := montgomeryModularInverse(zr, P(), R2_MOD_P())
            xr := montgomeryMul(xr, z_inv, P(), P_PRIME())
            xr := outOfMontgomeryForm(xr, P(), P_PRIME())

            xr := mod(xr, N())

            mstore(0, eq(xr, rTmp))
            return(0, 32)
        }
    }
}
